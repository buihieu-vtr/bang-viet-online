import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  FileText,
  Flame,
  Grid,
  Highlighter,
  Maximize2,
  Minimize2,
  MousePointer2,
  PanelBottom,
  Pen,
  RotateCcw,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  BoardElement,
  BoardPage,
  PAGE_DIMENSIONS,
  Point,
  StrokeItem,
  StrokeStyle,
  StylusSettings,
} from '../types/inkboard';
import { PptxDeck, PptxSlide, PptxTransition } from '../types/pptx';
import { hitTestElement, uid } from '../utils/geometry';
import {
  drawTemplatePattern,
  getTemplateColors,
  LaserPoint,
  renderElement,
  renderLaserTrail,
  renderStroke,
} from '../utils/renderer';
import { PptxSlideStage } from './PptxSlideStage';

type PresenterTool = 'pointer' | 'laser' | 'pen' | 'highlighter' | 'eraser';

interface SlideshowPresenterModalProps {
  open: boolean;
  onClose: () => void;
  deckTitle: string;
  pages: BoardPage[];
  pptxDeck?: PptxDeck;
  initialPageId: string;
  stylusSettings: StylusSettings;
  onCommitPageElements: (pageId: string, nextElements: BoardElement[]) => void;
  onSelectActivePage: (pageId: string) => void;
}

const QUICK_INK_COLORS = [
  '#DC2626',
  '#2563EB',
  '#0F172A',
  '#FFFFFF',
  '#FACC15',
  '#16A34A',
  '#9333EA',
];

const QUICK_HIGHLIGHT_COLORS = ['#FACC15', '#4ADE80', '#F472B6', '#38BDF8'];

function getTransitionKeyframes(
  tr: PptxTransition,
  forward: boolean
): { outCss?: React.CSSProperties; inCss?: React.CSSProperties } {
  const dur = `${Math.max(150, tr.durationMs || 550)}ms`;
  const dir = tr.direction || 'r';
  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';

  switch (tr.type) {
    case 'none':
    case 'cut':
      return {};
    case 'fade':
    case 'morph':
      return {
        outCss: { animation: `pptxFadeOut ${dur} ease ${'both'}` },
        inCss: { animation: `pptxFadeIn ${dur} ease ${'both'}` },
      };
    case 'dissolve':
    case 'checker':
      return {
        outCss: { animation: `pptxFadeOut ${dur} ease both` },
        inCss: { animation: `pptxDissolveIn ${dur} ${ease} both` },
      };
    case 'push': {
      const effDir = forward
        ? dir
        : dir === 'l'
          ? 'r'
          : dir === 'r'
            ? 'l'
            : dir === 'u'
              ? 'd'
              : 'u';
      if (effDir === 'l') {
        return {
          outCss: { animation: `pptxSlideOutRight ${dur} ${ease} both` },
          inCss: { animation: `pptxSlideInLeft ${dur} ${ease} both` },
        };
      }
      if (effDir === 'u') {
        return {
          outCss: { animation: `pptxSlideOutDown ${dur} ${ease} both` },
          inCss: { animation: `pptxSlideInDown ${dur} ${ease} both` },
        };
      }
      if (effDir === 'd') {
        return {
          outCss: { animation: `pptxSlideOutUp ${dur} ${ease} both` },
          inCss: { animation: `pptxSlideInUp ${dur} ${ease} both` },
        };
      }
      return {
        outCss: { animation: `pptxSlideOutLeft ${dur} ${ease} both` },
        inCss: { animation: `pptxSlideInRight ${dur} ${ease} both` },
      };
    }
    case 'cover': {
      const kf =
        dir === 'l'
          ? 'pptxSlideInLeft'
          : dir === 'u'
            ? 'pptxSlideInDown'
            : dir === 'd'
              ? 'pptxSlideInUp'
              : 'pptxSlideInRight';
      return {
        inCss: { animation: `${kf} ${dur} ${ease} both` },
      };
    }
    case 'uncover': {
      const kf =
        dir === 'l'
          ? 'pptxSlideOutRight'
          : dir === 'u'
            ? 'pptxSlideOutDown'
            : dir === 'd'
              ? 'pptxSlideOutUp'
              : 'pptxSlideOutLeft';
      return {
        outCss: { animation: `${kf} ${dur} ${ease} both`, zIndex: 5 },
      };
    }
    case 'wipe':
    case 'blinds': {
      const kf =
        dir === 'l'
          ? 'pptxWipeLeft'
          : dir === 'u'
            ? 'pptxWipeUp'
            : dir === 'd'
              ? 'pptxWipeDown'
              : 'pptxWipeRight';
      return {
        inCss: { animation: `${kf} ${dur} linear both` },
      };
    }
    case 'split':
      return {
        inCss: {
          animation: `${dir === 'vert' ? 'pptxSplitVertOut' : 'pptxSplitHorzOut'} ${dur} ${ease} both`,
        },
      };
    case 'circle':
    case 'wheel':
      return {
        inCss: { animation: `pptxCircleIn ${dur} ${ease} both` },
      };
    case 'diamond':
      return {
        inCss: { animation: `pptxDiamondIn ${dur} ${ease} both` },
      };
    case 'zoom':
      return {
        outCss: { animation: `pptxFadeOut ${dur} ease both` },
        inCss: { animation: `pptxZoomIn ${dur} ${ease} both` },
      };
    default:
      return {
        outCss: { animation: `pptxFadeOut ${dur} ease both` },
        inCss: { animation: `pptxFadeIn ${dur} ease both` },
      };
  }
}

export const SlideshowPresenterModal: React.FC<SlideshowPresenterModalProps> = ({
  open,
  onClose,
  deckTitle,
  pages,
  pptxDeck,
  initialPageId,
  stylusSettings,
  onCommitPageElements,
  onSelectActivePage,
}) => {
  const slideEntries = useMemo(() => {
    const pptByPageId = new Map<string, PptxSlide>();
    if (pptxDeck) {
      for (const s of pptxDeck.slides) {
        pptByPageId.set(s.pageId, s);
      }
    }
    return pages.map((page, idx) => {
      const pptSlide = pptByPageId.get(page.id);
      const dims = pptxDeck && pptSlide
        ? { width: pptxDeck.width, height: pptxDeck.height }
        : page.pageSize === 'infinite'
          ? PAGE_DIMENSIONS.slide16x9
          : PAGE_DIMENSIONS[page.pageSize];
      return {
        index: idx,
        page,
        pptSlide,
        width: dims.width,
        height: dims.height,
      };
    });
  }, [pages, pptxDeck]);

  const [slideIdx, setSlideIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [justTriggeredStep, setJustTriggeredStep] = useState<number | null>(0);
  const [animNonce, setAnimNonce] = useState(1);

  const [outgoing, setOutgoing] = useState<{
    index: number;
    stepIdx: number;
    tr: PptxTransition;
    forward: boolean;
    nonce: number;
  } | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  // Presenter Tools & Ink State
  const [tool, setTool] = useState<PresenterTool>('pointer');
  const [penColor, setPenColor] = useState('#DC2626');
  const [penWidth, setPenWidth] = useState(4);
  const [penStyle, setPenStyle] = useState<StrokeStyle>('solid');
  const [hlColor, setHlColor] = useState('#FACC15');
  const [hlWidth, setHlWidth] = useState(26);
  const [dockVisible, setDockVisible] = useState(true);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Scratch Board ("Bảng nháp khi giảng")
  const [scratchOpen, setScratchOpen] = useState(false);
  const [scratchTheme, setScratchTheme] = useState<'green' | 'white'>('green');
  const [scratchStrokes, setScratchStrokes] = useState<StrokeItem[]>([]);

  // Stage Layout Scaling
  const viewportRef = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState({ w: 1280, h: 720 });
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const liveStrokeRef = useRef<StrokeItem | null>(null);
  const lastDrawRawRef = useRef<{ x: number; y: number; t: number; pressure: number } | null>(null);
  const erasingRef = useRef(false);
  const laserPointsRef = useRef<LaserPoint[]>([]);
  const laserRafRef = useRef(0);
  const drawingPointerIdRef = useRef<number | null>(null);

  // Sync starting slide when opening
  useEffect(() => {
    if (!open) return;
    const found = slideEntries.findIndex((e) => e.page.id === initialPageId);
    setSlideIdx(found >= 0 ? found : 0);
    setStepIdx(0);
    setJustTriggeredStep(0);
    setAnimNonce((n) => n + 1);
    setOutgoing(null);
    setOverviewOpen(false);
    setNotesOpen(false);
    setScratchOpen(false);
  }, [open, initialPageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track Fullscreen state
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Measure viewport container
  useEffect(() => {
    if (!open) return;
    const updateSize = () => {
      const el = viewportRef.current;
      if (!el) return;
      setBoxSize({ w: el.clientWidth, h: el.clientHeight });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [open]);

  const current = slideEntries[slideIdx] || slideEntries[0];
  const totalSlides = slideEntries.length;
  const totalSteps = current?.pptSlide?.clickSteps.length || 0;

  const goToSlide = useCallback(
    (nextIndex: number, initialStep = 0) => {
      if (nextIndex < 0 || nextIndex >= slideEntries.length || nextIndex === slideIdx) return;
      const target = slideEntries[nextIndex];
      const forward = nextIndex > slideIdx;
      const tr: PptxTransition = target.pptSlide?.transition || {
        type: 'fade',
        durationMs: 380,
        advanceOnClick: true,
      };

      if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
      if (tr.type !== 'none' && tr.type !== 'cut' && tr.durationMs > 0) {
        setOutgoing({
          index: slideIdx,
          stepIdx,
          tr,
          forward,
          nonce: Date.now(),
        });
        transitionTimerRef.current = window.setTimeout(() => {
          setOutgoing(null);
        }, tr.durationMs + 40);
      } else {
        setOutgoing(null);
      }

      setSlideIdx(nextIndex);
      setStepIdx(initialStep);
      setJustTriggeredStep(initialStep === 0 ? 0 : null);
      setAnimNonce((n) => n + 1);
      onSelectActivePage(target.page.id);
    },
    [slideEntries, slideIdx, stepIdx, onSelectActivePage]
  );

  const handleNext = useCallback(() => {
    if (!current) return;
    if (stepIdx < totalSteps) {
      const nextStep = stepIdx + 1;
      setStepIdx(nextStep);
      setJustTriggeredStep(nextStep);
      setAnimNonce((n) => n + 1);
      return;
    }
    if (slideIdx < totalSlides - 1) {
      goToSlide(slideIdx + 1, 0);
    }
  }, [current, stepIdx, totalSteps, slideIdx, totalSlides, goToSlide]);

  const handlePrev = useCallback(() => {
    if (!current) return;
    if (stepIdx > 0) {
      setStepIdx((s) => Math.max(0, s - 1));
      setJustTriggeredStep(null);
      return;
    }
    if (slideIdx > 0) {
      const prevEntry = slideEntries[slideIdx - 1];
      const prevMaxSteps = prevEntry.pptSlide?.clickSteps.length || 0;
      goToSlide(slideIdx - 1, prevMaxSteps);
    }
  }, [current, stepIdx, slideIdx, slideEntries, goToSlide]);

  // Auto-advance timer (`advTm`) if slide specifies it
  useEffect(() => {
    if (!open || !current?.pptSlide?.transition.advanceAfterMs) return;
    const ms = current.pptSlide.transition.advanceAfterMs;
    const id = window.setTimeout(() => {
      handleNext();
    }, ms);
    return () => window.clearTimeout(id);
  }, [open, slideIdx, stepIdx, current, handleNext]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (overviewOpen) setOverviewOpen(false);
        else if (scratchOpen) setScratchOpen(false);
        else onClose();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') {
        if (!scratchOpen) {
          e.preventDefault();
          handleNext();
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Backspace') {
        if (!scratchOpen) {
          e.preventDefault();
          handlePrev();
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === '1' || k === 'm') setTool('pointer');
      else if (k === '2' || k === 'l') setTool('laser');
      else if (k === '3' || k === 'p') setTool('pen');
      else if (k === '4' || k === 'h') setTool('highlighter');
      else if (k === '5' || k === 'e') setTool('eraser');
      else if (k === 'b') setScratchOpen((v) => !v);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, overviewOpen, scratchOpen, handleNext, handlePrev, onClose]);

  const stageMetrics = useMemo(() => {
    const sw = current?.width || 1600;
    const sh = current?.height || 900;
    const pad = 16;
    const availW = Math.max(240, boxSize.w - pad * 2);
    const availH = Math.max(180, boxSize.h - pad * 2);
    const scale = Math.min(availW / sw, availH / sh);
    return {
      slideW: sw,
      slideH: sh,
      scale,
      renderedW: sw * scale,
      renderedH: sh * scale,
    };
  }, [current, boxSize]);

  // Draw Ink Overlay Canvas (and Scratch Board if open)
  const drawInkCanvas = useCallback(() => {
    const canvas = inkCanvasRef.current;
    if (!canvas || !current) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, Math.round(stageMetrics.renderedW * dpr));
    const ch = Math.max(1, Math.round(stageMetrics.renderedH * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    const totalScale = dpr * stageMetrics.scale;
    ctx.scale(totalScale, totalScale);

    if (scratchOpen) {
      const tplId = scratchTheme === 'green' ? 'greenboard' : 'blank';
      const tpl = getTemplateColors(tplId);
      ctx.fillStyle = tpl.bg;
      ctx.fillRect(0, 0, stageMetrics.slideW, stageMetrics.slideH);
      drawTemplatePattern(ctx, tplId, tpl.line, 40, 0, 0, stageMetrics.slideW, stageMetrics.slideH);
      for (const s of scratchStrokes) {
        renderStroke(ctx, s);
      }
    } else {
      // Draw only non-locked whiteboard elements (user ink, highlights, shapes, notes) on top of live slide
      // If there's NO pptxDeck, ALSO draw locked background PDF/image elements when page wasn't rendered in HTML
      const showLockedImages = !current.pptSlide;
      for (const el of current.page.elements) {
        if (!showLockedImages && el.type === 'image' && el.locked) continue;
        renderElement(ctx, el, imageCacheRef.current, () => drawInkCanvas());
      }
    }

    if (liveStrokeRef.current) {
      renderStroke(ctx, liveStrokeRef.current);
    }

    const now = performance.now();
    laserPointsRef.current = laserPointsRef.current.filter((lp) => now - lp.t < 750);
    if (laserPointsRef.current.length >= 2) {
      renderLaserTrail(ctx, laserPointsRef.current, now);
    }

    ctx.restore();
  }, [current, stageMetrics, scratchOpen, scratchTheme, scratchStrokes]);

  useEffect(() => {
    if (!open) return;
    drawInkCanvas();
  }, [open, drawInkCanvas, slideIdx, current?.page.elements]);

  const startLaserLoop = useCallback(() => {
    if (laserRafRef.current) return;
    const step = () => {
      const now = performance.now();
      laserPointsRef.current = laserPointsRef.current.filter((lp) => now - lp.t < 750);
      drawInkCanvas();
      if (laserPointsRef.current.length > 0) {
        laserRafRef.current = requestAnimationFrame(step);
      } else {
        laserRafRef.current = 0;
      }
    };
    laserRafRef.current = requestAnimationFrame(step);
  }, [drawInkCanvas]);

  useEffect(() => {
    return () => {
      if (laserRafRef.current) cancelAnimationFrame(laserRafRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  const toSlidePoint = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * stageMetrics.slideW,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * stageMetrics.slideH,
    };
  };

  const handleStagePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!current) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Stylus-only / Gaomon pre-contact guard
    if (stylusSettings.stylusOnly && e.pointerType === 'touch') return;
    if (
      e.pointerType === 'pen' &&
      stylusSettings.activationThreshold > 0 &&
      e.pressure > 0 &&
      e.pressure < stylusSettings.activationThreshold
    ) {
      return;
    }

    if (tool === 'pointer' && !scratchOpen) {
      handleNext();
      return;
    }

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drawingPointerIdRef.current = e.pointerId;
    const pt = toSlidePoint(e.clientX, e.clientY);

    if (tool === 'laser') {
      laserPointsRef.current.push({ x: pt.x, y: pt.y, t: performance.now() });
      startLaserLoop();
      return;
    }

    if (tool === 'eraser') {
      erasingRef.current = true;
      if (scratchOpen) {
        setScratchStrokes((prev) => prev.filter((s) => !hitTestElement(s, pt, 16)));
      } else {
        const filtered = current.page.elements.filter(
          (el) => (el.type === 'image' && el.locked) || !hitTestElement(el, pt, 16)
        );
        if (filtered.length !== current.page.elements.length) {
          onCommitPageElements(current.page.id, filtered);
        }
      }
      return;
    }

    const isHl = tool === 'highlighter';
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.55;
    const stroke: StrokeItem = {
      id: uid('ppt_ink'),
      type: 'stroke',
      tool: isHl ? 'highlighter' : 'pen',
      points: [{ x: pt.x, y: pt.y, pressure, t: Date.now() }],
      color: isHl ? hlColor : scratchOpen && scratchTheme === 'green' && penColor === '#0F172A' ? '#FFFFFF' : penColor,
      width: isHl ? hlWidth : penWidth,
      opacity: isHl ? 0.45 : 1,
      lineStyle: isHl ? 'solid' : penStyle,
      highlightMode: isHl ? 'pdf' : undefined,
    };
    liveStrokeRef.current = stroke;
    lastDrawRawRef.current = { x: pt.x, y: pt.y, t: performance.now(), pressure };
    drawInkCanvas();
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingPointerIdRef.current !== e.pointerId || !current) return;

    if (tool === 'laser') {
      const pt = toSlidePoint(e.clientX, e.clientY);
      laserPointsRef.current.push({ x: pt.x, y: pt.y, t: performance.now() });
      startLaserLoop();
      return;
    }

    if (tool === 'eraser' && erasingRef.current) {
      const pt = toSlidePoint(e.clientX, e.clientY);
      if (scratchOpen) {
        setScratchStrokes((prev) => prev.filter((s) => !hitTestElement(s, pt, 16)));
      } else {
        const filtered = current.page.elements.filter(
          (el) => (el.type === 'image' && el.locked) || !hitTestElement(el, pt, 16)
        );
        if (filtered.length !== current.page.elements.length) {
          onCommitPageElements(current.page.id, filtered);
        }
      }
      return;
    }

    const stroke = liveStrokeRef.current;
    if (!stroke) return;

    const nativeEv = e.nativeEvent as PointerEvent;
    const coalesced =
      typeof nativeEv.getCoalescedEvents === 'function' ? nativeEv.getCoalescedEvents() : [];
    const evList = coalesced.length > 0 ? coalesced : [nativeEv];

    let changed = false;
    for (const ce of evList) {
      if (ce.pointerType === 'pen' && (ce.buttons & 1) === 0) continue;
      const pt = toSlidePoint(ce.clientX, ce.clientY);
      const last = lastDrawRawRef.current;
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) continue;
      const prevP = last?.pressure ?? 0.55;
      const p = ce.pointerType === 'pen' && ce.pressure > 0 ? prevP * 0.5 + ce.pressure * 0.5 : 0.55;
      const lastPt = stroke.points[stroke.points.length - 1];
      const sx = lastPt ? lastPt.x * 0.32 + pt.x * 0.68 : pt.x;
      const sy = lastPt ? lastPt.y * 0.32 + pt.y * 0.68 : pt.y;
      stroke.points.push({ x: sx, y: sy, pressure: p, t: Date.now() });
      lastDrawRawRef.current = { x: pt.x, y: pt.y, t: performance.now(), pressure: p };
      changed = true;
    }

    if (changed) drawInkCanvas();
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingPointerIdRef.current !== e.pointerId) return;
    drawingPointerIdRef.current = null;
    erasingRef.current = false;

    const stroke = liveStrokeRef.current;
    liveStrokeRef.current = null;
    lastDrawRawRef.current = null;

    if (stroke && current) {
      if (stroke.points.length === 1) {
        const p0: Point = stroke.points[0];
        stroke.points.push({ ...p0, x: p0.x + 0.5, y: p0.y + 0.5 });
      }
      if (scratchOpen) {
        setScratchStrokes((prev) => [...prev, stroke]);
      } else {
        onCommitPageElements(current.page.id, [...current.page.elements, stroke]);
      }
    }
    drawInkCanvas();
  };

  const handleUndoInk = () => {
    if (!current) return;
    if (scratchOpen) {
      setScratchStrokes((prev) => prev.slice(0, -1));
      return;
    }
    const idxToRemove = [...current.page.elements]
      .reverse()
      .findIndex((el) => !(el.type === 'image' && el.locked));
    if (idxToRemove === -1) return;
    const realIdx = current.page.elements.length - 1 - idxToRemove;
    const next = [...current.page.elements];
    next.splice(realIdx, 1);
    onCommitPageElements(current.page.id, next);
  };

  const handleClearSlideInk = () => {
    if (!current) return;
    if (scratchOpen) {
      setScratchStrokes([]);
      return;
    }
    const kept = current.page.elements.filter((el) => el.type === 'image' && el.locked);
    onCommitPageElements(current.page.id, kept);
  };

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen denial inside sandbox iframe
    }
  };

  if (!open || !current) return null;

  const outgoingEntry = outgoing ? slideEntries[outgoing.index] : null;
  const trAnim = outgoing ? getTransitionKeyframes(outgoing.tr, outgoing.forward) : {};
  const hasInkOnSlide = scratchOpen
    ? scratchStrokes.length > 0
    : current.page.elements.some((el) => !(el.type === 'image' && el.locked));

  const cursorClass =
    tool === 'pointer' && !scratchOpen
      ? 'cursor-pointer'
      : tool === 'laser'
        ? 'cursor-crosshair'
        : tool === 'eraser'
          ? 'cursor-cell'
          : 'cursor-crosshair';

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0D13] text-white flex flex-col select-none overflow-hidden">
      {/* Top Floating Micro Header (Title + Replay + Exit) */}
      <div className="h-11 px-3 sm:px-4 flex items-center justify-between bg-slate-950/75 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs sm:text-sm font-semibold text-white truncate max-w-[42vw]">
            {deckTitle}
          </span>
          <span className="text-[11px] font-mono-tabular text-slate-400 shrink-0">
            Slide {slideIdx + 1}/{totalSlides}
            {totalSteps > 0 ? ` · Hiệu ứng ${stepIdx}/${totalSteps}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {current.pptSlide && totalSteps > 0 && (
            <button
              type="button"
              onClick={() => {
                setStepIdx(0);
                setJustTriggeredStep(0);
                setAnimNonce((n) => n + 1);
              }}
              title="Chạy lại hiệu ứng từ đầu slide này"
              className="h-7 px-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chạy lại slide</span>
            </button>
          )}

          {current.pptSlide?.notes && (
            <button
              type="button"
              onClick={() => setNotesOpen((v) => !v)}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
                notesOpen ? 'bg-amber-500 text-slate-950' : 'bg-white/10 hover:bg-white/15'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ghi chú</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/15 flex items-center justify-center cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Thoát trình chiếu (Esc)"
            className="h-7 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Thoát</span>
          </button>
        </div>
      </div>

      {/* Main Presentation Stage */}
      <div
        ref={viewportRef}
        className="relative flex-1 flex items-center justify-center overflow-hidden"
      >
        <div
          style={{
            width: stageMetrics.renderedW,
            height: stageMetrics.renderedH,
          }}
          className="relative rounded-md overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.65)] bg-white"
        >
          {/* Outgoing Slide Layer (for transitions) */}
          {outgoing && outgoingEntry && (
            <div
              key={`out-${outgoing.nonce}`}
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                ...trAnim.outCss,
              }}
            >
              <div
                style={{
                  width: outgoingEntry.width,
                  height: outgoingEntry.height,
                  transform: `scale(${stageMetrics.scale})`,
                  transformOrigin: 'top left',
                }}
              >
                {outgoingEntry.pptSlide ? (
                  <PptxSlideStage
                    slide={outgoingEntry.pptSlide}
                    width={outgoingEntry.width}
                    height={outgoingEntry.height}
                    stepIndex={outgoing.stepIdx}
                    justTriggeredStep={null}
                    animNonce={0}
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{ backgroundColor: getTemplateColors(outgoingEntry.page.template).bg }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Incoming / Active Slide Layer */}
          {!scratchOpen && current.pptSlide && (
            <div
              key={outgoing ? `in-${outgoing.nonce}` : `slide-${current.page.id}`}
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                ...trAnim.inCss,
              }}
            >
              <div
                style={{
                  width: stageMetrics.slideW,
                  height: stageMetrics.slideH,
                  transform: `scale(${stageMetrics.scale})`,
                  transformOrigin: 'top left',
                }}
              >
                <PptxSlideStage
                  slide={current.pptSlide}
                  width={stageMetrics.slideW}
                  height={stageMetrics.slideH}
                  stepIndex={stepIdx}
                  justTriggeredStep={justTriggeredStep}
                  animNonce={animNonce}
                />
              </div>
            </div>
          )}

          {/* Non-PPTX Fallback Background Layer */}
          {!scratchOpen && !current.pptSlide && (
            <div
              key={outgoing ? `in-${outgoing.nonce}` : `page-${current.page.id}`}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: getTemplateColors(current.page.template).bg,
                pointerEvents: 'none',
                ...trAnim.inCss,
              }}
            />
          )}

          {/* Live Ink / Laser / Scratch Board Canvas Overlay */}
          <canvas
            ref={inkCanvasRef}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={handleStagePointerUp}
            onPointerCancel={handleStagePointerUp}
            style={{
              width: stageMetrics.renderedW,
              height: stageMetrics.renderedH,
            }}
            className={`absolute inset-0 z-10 block touch-none-canvas ${cursorClass}`}
          />
        </div>

        {/* Left / Right Subtle Edge Nav Buttons */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={slideIdx === 0 && stepIdx === 0}
          title="Lùi bước / Slide trước (←)"
          className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/65 hover:bg-slate-900/90 border border-white/15 items-center justify-center text-white disabled:opacity-20 cursor-pointer transition-opacity z-20"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={slideIdx === totalSlides - 1 && stepIdx >= totalSteps}
          title="Hiệu ứng tiếp / Slide sau (→ / Space)"
          className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/65 hover:bg-slate-900/90 border border-white/15 items-center justify-center text-white disabled:opacity-20 cursor-pointer transition-opacity z-20"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Speaker Notes Drawer */}
        {notesOpen && current.pptSlide?.notes && (
          <div className="absolute top-3 right-3 z-30 w-80 max-w-[calc(100vw-24px)] max-h-56 overflow-y-auto rounded-xl bg-slate-900/95 border border-amber-500/40 p-3 shadow-2xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-amber-400">
                Ghi chú diễn giả — Slide {slideIdx + 1}
              </span>
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
              {current.pptSlide.notes}
            </p>
          </div>
        )}

        {/* Slide Overview Grid Overlay */}
        {overviewOpen && (
          <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-base text-white">
                  Tất cả Slide ({totalSlides})
                </h3>
                <button
                  type="button"
                  onClick={() => setOverviewOpen(false)}
                  className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium cursor-pointer"
                >
                  Đóng
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {slideEntries.map((entry) => {
                  const active = entry.index === slideIdx;
                  return (
                    <button
                      key={entry.page.id}
                      type="button"
                      onClick={() => {
                        setOverviewOpen(false);
                        setScratchOpen(false);
                        goToSlide(entry.index, 0);
                      }}
                      className={`group rounded-xl overflow-hidden border text-left transition-all cursor-pointer bg-slate-900 ${
                        active
                          ? 'border-orange-500 ring-2 ring-orange-500/60'
                          : 'border-white/15 hover:border-white/40'
                      }`}
                    >
                      <div className="aspect-video w-full bg-white relative overflow-hidden">
                        {entry.pptSlide ? (
                          <div
                            style={{
                              width: entry.width,
                              height: entry.height,
                              transform: 'scale(0.18)',
                              transformOrigin: 'top left',
                            }}
                          >
                            <PptxSlideStage
                              slide={entry.pptSlide}
                              width={entry.width}
                              height={entry.height}
                              stepIndex={entry.pptSlide.clickSteps.length}
                              justTriggeredStep={null}
                              animNonce={0}
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                            {entry.page.title}
                          </div>
                        )}
                      </div>
                      <div className="px-2.5 py-2 flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate font-medium text-slate-200">
                          {entry.index + 1}. {entry.pptSlide?.title || entry.page.title}
                        </span>
                        {entry.pptSlide && entry.pptSlide.clickSteps.length > 0 && (
                          <span className="text-[10px] font-mono-tabular text-orange-400 shrink-0">
                            {entry.pptSlide.clickSteps.length} hiệu ứng
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Presenter + Blackboard Dock */}
      <div className="px-2 pb-2.5 pt-1 flex justify-center shrink-0">
        {!dockVisible ? (
          <button
            type="button"
            onClick={() => setDockVisible(true)}
            className="h-8 px-3 rounded-full bg-slate-900/90 border border-white/15 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            Hiện thanh trình chiếu &amp; viết bảng
          </button>
        ) : (
          <div className="flex items-center gap-1 sm:gap-1.5 rounded-2xl bg-slate-900/95 border border-white/15 px-2.5 py-1.5 shadow-2xl max-w-full overflow-x-auto no-scrollbar">
            {/* Step / Slide Nav */}
            <button
              type="button"
              onClick={handlePrev}
              disabled={slideIdx === 0 && stepIdx === 0}
              title="Lùi bước / Slide trước"
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setOverviewOpen((v) => !v)}
              title="Xem lưới toàn bộ slide"
              className="h-8 px-2 rounded-lg hover:bg-white/10 text-xs font-mono-tabular flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Grid className="w-3.5 h-3.5 text-orange-400" />
              <span>
                {slideIdx + 1}/{totalSlides}
              </span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={slideIdx === totalSlides - 1 && stepIdx >= totalSteps}
              title="Hiệu ứng tiếp / Slide tiếp"
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 cursor-pointer shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-white/15 mx-0.5 shrink-0" />

            {/* Presentation Modes: Pointer / Laser / Pen / Highlighter / Eraser */}
            {(
              [
                { id: 'pointer', label: 'Trình chiếu (Click chạy hiệu ứng)', icon: <MousePointer2 className="w-4 h-4" /> },
                { id: 'laser', label: 'Laser đỏ', icon: <Flame className="w-4 h-4" /> },
                { id: 'pen', label: 'Bút viết lên slide', icon: <Pen className="w-4 h-4" /> },
                { id: 'highlighter', label: 'Bút dạ quang', icon: <Highlighter className="w-4 h-4" /> },
                { id: 'eraser', label: 'Tẩy nét viết', icon: <Eraser className="w-4 h-4" /> },
              ] as const
            ).map((item) => {
              const active = tool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => setTool(item.id)}
                  className={`h-8 px-2 rounded-lg flex items-center gap-1 text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                    active
                      ? item.id === 'pointer'
                        ? 'bg-orange-600 text-white'
                        : item.id === 'laser'
                          ? 'bg-rose-600 text-white'
                          : 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {item.icon}
                  <span className="hidden lg:inline">
                    {item.id === 'pointer'
                      ? 'Chạy'
                      : item.id === 'laser'
                        ? 'Laser'
                        : item.id === 'pen'
                          ? 'Viết'
                          : item.id === 'highlighter'
                            ? 'Dạ quang'
                            : 'Tẩy'}
                  </span>
                </button>
              );
            })}

            {/* Quick Pen Color & Style Controls */}
            {tool === 'pen' && (
              <>
                <div className="w-px h-5 bg-white/15 mx-0.5 shrink-0" />
                <div className="flex items-center gap-1 shrink-0">
                  {QUICK_INK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPenColor(c)}
                      className={`w-5 h-5 rounded-full border cursor-pointer transition-transform ${
                        penColor === c ? 'scale-115 ring-2 ring-white border-white' : 'border-white/30'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPenWidth((w) => (w >= 8 ? 2 : w + 2))}
                  title="Đổi độ dày nét"
                  className="h-7 px-1.5 rounded bg-white/10 hover:bg-white/15 text-[11px] font-mono-tabular cursor-pointer shrink-0"
                >
                  {penWidth}px
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPenStyle((s) =>
                      s === 'solid' ? 'dashed' : s === 'dashed' ? 'dotted' : 'solid'
                    )
                  }
                  title="Đổi kiểu nét (Liền / Đứt / Chấm)"
                  className="h-7 px-1.5 rounded bg-white/10 hover:bg-white/15 text-[11px] cursor-pointer shrink-0"
                >
                  {penStyle === 'solid' ? 'Liền' : penStyle === 'dashed' ? 'Đứt' : 'Chấm'}
                </button>
              </>
            )}

            {/* Quick Highlighter Controls */}
            {tool === 'highlighter' && (
              <>
                <div className="w-px h-5 bg-white/15 mx-0.5 shrink-0" />
                <div className="flex items-center gap-1 shrink-0">
                  {QUICK_HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setHlColor(c)}
                      className={`w-5 h-5 rounded border cursor-pointer ${
                        hlColor === c ? 'ring-2 ring-white border-white' : 'border-white/30'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setHlWidth((w) => (w >= 40 ? 18 : w + 6))}
                  className="h-7 px-1.5 rounded bg-white/10 hover:bg-white/15 text-[11px] font-mono-tabular cursor-pointer shrink-0"
                >
                  {hlWidth}px
                </button>
              </>
            )}

            <div className="w-px h-5 bg-white/15 mx-0.5 shrink-0" />

            {/* Undo & Clear Ink */}
            <button
              type="button"
              onClick={handleUndoInk}
              disabled={!hasInkOnSlide}
              title="Hoàn tác nét viết vừa rồi"
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 cursor-pointer shrink-0"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleClearSlideInk}
              disabled={!hasInkOnSlide}
              title={scratchOpen ? 'Xóa bảng nháp' : 'Xóa toàn bộ mực viết trên slide này'}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-500/20 disabled:opacity-30 cursor-pointer shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Quick Scratch Chalkboard / Whiteboard Toggle */}
            <button
              type="button"
              onClick={() => {
                setScratchOpen((prev) => {
                  const next = !prev;
                  if (next && (tool === 'pointer' || tool === 'laser')) {
                    setTool('pen');
                    if (scratchTheme === 'green') setPenColor('#FFFFFF');
                  }
                  return next;
                });
              }}
              title="Bật/tắt Bảng nháp viết thêm khi đang giảng (Phím B)"
              className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                scratchOpen
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 text-slate-200 hover:bg-white/15'
              }`}
            >
              <PanelBottom className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bảng nháp</span>
            </button>

            {scratchOpen && (
              <button
                type="button"
                onClick={() => setScratchTheme((t) => (t === 'green' ? 'white' : 'green'))}
                className="h-7 px-2 rounded bg-white/10 hover:bg-white/15 text-[11px] cursor-pointer shrink-0"
              >
                {scratchTheme === 'green' ? 'Bảng trắng' : 'Bảng xanh'}
              </button>
            )}

            <button
              type="button"
              onClick={() => setDockVisible(false)}
              title="Thu gọn thanh điều khiển"
              className="h-7 px-1.5 rounded text-[11px] text-slate-400 hover:text-white cursor-pointer shrink-0"
            >
              Ẩn
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

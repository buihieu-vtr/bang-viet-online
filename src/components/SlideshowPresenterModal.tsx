import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Axis3D,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Columns2,
  Diamond,
  Eraser,
  FileText,
  Flame,
  Grid,
  Grid3X3,
  Highlighter,
  Lasso,
  Magnet,
  Maximize2,
  Minimize2,
  Minus,
  MousePointer2,
  PanelBottom,
  Pen,
  Pencil,
  Redo2,
  RotateCcw,
  Shapes,
  Square,
  Star,
  Trash2,
  Triangle,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import {
  BoardElement,
  BoardPage,
  EraserMode,
  HighlightMode,
  OsnapSettings,
  PAGE_DIMENSIONS,
  PaperTemplate,
  SelectMode,
  ShapeType,
  SnapType,
  StrokeStyle,
  StylusSettings,
} from '../types/inkboard';
import { PptxDeck, PptxSlide, PptxTransition } from '../types/pptx';
import { isLinearShapeType, OSNAP_META } from '../utils/osnap';
import { getTemplateColors } from '../utils/renderer';
import { ColorPalettePicker } from './ColorPalettePicker';
import { PptxSlideStage } from './PptxSlideStage';
import {
  PresenterInteractiveCanvas,
  PresenterTool,
} from './PresenterInteractiveCanvas';

type ScratchMode = 'off' | 'side' | 'full';
type ScratchSurface = 'greenboard' | 'blank' | 'chalkboard';

interface SlideshowPresenterModalProps {
  open: boolean;
  onClose: () => void;
  deckTitle: string;
  pages: BoardPage[];
  pptxDeck?: PptxDeck;
  initialPageId: string;
  stylusSettings: StylusSettings;
  osnap: OsnapSettings;
  onOsnapChange: React.Dispatch<React.SetStateAction<OsnapSettings>>;
  customColors: string[];
  onAddCustomColor: (hex: string) => void;
  onRemoveCustomColor: (hex: string) => void;
  onCommitPageElements: (pageId: string, nextElements: BoardElement[]) => void;
  onSelectActivePage: (pageId: string) => void;
}

const SHAPE_OPTIONS: { id: ShapeType; label: string; icon: React.ReactNode }[] = [
  { id: 'line', label: 'Đoạn thẳng', icon: <Minus className="w-4 h-4 -rotate-45" /> },
  { id: 'arrow', label: 'Mũi tên', icon: <ArrowUpRight className="w-4 h-4" /> },
  { id: 'doubleArrow', label: 'Mũi tên 2 chiều', icon: <ArrowRight className="w-4 h-4" /> },
  { id: 'rect', label: 'Hình chữ nhật', icon: <Square className="w-4 h-4" /> },
  { id: 'roundedRect', label: 'Bo góc', icon: <Square className="w-4 h-4 rounded-sm" /> },
  { id: 'ellipse', label: 'Hình tròn / Elip', icon: <Circle className="w-4 h-4" /> },
  { id: 'triangle', label: 'Tam giác cân', icon: <Triangle className="w-4 h-4" /> },
  { id: 'rightTriangle', label: 'Tam giác vuông', icon: <Triangle className="w-4 h-4" /> },
  { id: 'diamond', label: 'Hình thoi', icon: <Diamond className="w-4 h-4" /> },
  { id: 'star', label: 'Ngôi sao', icon: <Star className="w-4 h-4" /> },
  { id: 'axes', label: 'Hệ trục Oxy', icon: <Axis3D className="w-4 h-4" /> },
  { id: 'table', label: 'Bảng 3×3', icon: <Grid3X3 className="w-4 h-4" /> },
];

const QUICK_INK_COLORS = ['#DC2626', '#2563EB', '#0F172A', '#FFFFFF', '#FACC15', '#16A34A'];

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
        outCss: { animation: `pptxFadeOut ${dur} ease both` },
        inCss: { animation: `pptxFadeIn ${dur} ease both` },
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
      return { inCss: { animation: `${kf} ${dur} ${ease} both` } };
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
      return { outCss: { animation: `${kf} ${dur} ${ease} both`, zIndex: 5 } };
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
      return { inCss: { animation: `${kf} ${dur} linear both` } };
    }
    case 'split':
      return {
        inCss: {
          animation: `${dir === 'vert' ? 'pptxSplitVertOut' : 'pptxSplitHorzOut'} ${dur} ${ease} both`,
        },
      };
    case 'circle':
    case 'wheel':
      return { inCss: { animation: `pptxCircleIn ${dur} ${ease} both` } };
    case 'diamond':
      return { inCss: { animation: `pptxDiamondIn ${dur} ${ease} both` } };
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
  osnap,
  onOsnapChange,
  customColors,
  onAddCustomColor,
  onRemoveCustomColor,
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
      const dims =
        pptxDeck && pptSlide
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

  // Full Toolset State
  const [tool, setTool] = useState<PresenterTool>('pointer');
  const [selectMode, setSelectMode] = useState<SelectMode>('lasso');
  const [penColor, setPenColor] = useState('#DC2626');
  const [penWidth, setPenWidth] = useState(3.5);
  const [penStyle, setPenStyle] = useState<StrokeStyle>('solid');

  const [hlColor, setHlColor] = useState('#FACC15');
  const [hlWidth, setHlWidth] = useState(24);
  const [hlOpacity, setHlOpacity] = useState(0.45);
  const [hlMode, setHlMode] = useState<HighlightMode>('pdf');
  const [hlStraight, setHlStraight] = useState(false);

  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
  const [eraserSize, setEraserSize] = useState(26);

  const [activeShape, setActiveShape] = useState<ShapeType>('line');
  const [shapeStrokeColor, setShapeStrokeColor] = useState('#2563EB');
  const [shapeFillColor, setShapeFillColor] = useState('transparent');
  const [shapeLineStyle, setShapeLineStyle] = useState<StrokeStyle>('solid');
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(3);
  const [shapeColorTab, setShapeColorTab] = useState<'stroke' | 'fill'>('stroke');

  const [inkToShape, setInkToShape] = useState(false);

  // Active Target ('slide' or 'scratch') + Undo/Redo + Selection
  const [activeTarget, setActiveTarget] = useState<'slide' | 'scratch'>('slide');
  const [slideSelectedIds, setSlideSelectedIds] = useState<string[]>([]);
  const [scratchSelectedIds, setScratchSelectedIds] = useState<string[]>([]);
  const [slideRedoMap, setSlideRedoMap] = useState<Record<string, BoardElement[][]>>({});
  const [slideUndoMap, setSlideUndoMap] = useState<Record<string, BoardElement[][]>>({});

  // Scratchboard State ('off' | 'side' | 'full')
  const [scratchMode, setScratchMode] = useState<ScratchMode>('off');
  const [scratchSurface, setScratchSurface] = useState<ScratchSurface>('greenboard');
  const [scratchElements, setScratchElements] = useState<BoardElement[]>([]);
  const [scratchUndo, setScratchUndo] = useState<BoardElement[][]>([]);
  const [scratchRedo, setScratchRedo] = useState<BoardElement[][]>([]);
  const [splitRatio, setSplitRatio] = useState(0.56); // Slide gets 56%, right scratchboard gets 44%
  const draggingSplitRef = useRef(false);

  // Popovers & Panels
  const [openMenu, setOpenMenu] = useState<
    'select' | 'pen' | 'highlighter' | 'eraser' | 'shape' | 'osnap' | null
  >(null);
  const [dockVisible, setDockVisible] = useState(true);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const dockRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const mainRowRef = useRef<HTMLDivElement>(null);
  const slidePaneRef = useRef<HTMLDivElement>(null);
  const scratchPaneRef = useRef<HTMLDivElement>(null);
  const [slideBox, setSlideBox] = useState({ w: 1200, h: 720 });
  const [scratchBox, setScratchBox] = useState({ w: 600, h: 720 });

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
    setOpenMenu(null);
    setSlideSelectedIds([]);
    setScratchSelectedIds([]);
  }, [open, initialPageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track Fullscreen state
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Close dock popover on outside click
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dockRef.current &&
        !dockRef.current.contains(target) &&
        (!popoverRef.current || !popoverRef.current.contains(target))
      ) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [openMenu]);

  // Measure left/slide pane and right/full scratchboard pane via ResizeObserver
  useEffect(() => {
    if (!open) return;
    const updateSizes = () => {
      if (slidePaneRef.current) {
        setSlideBox({
          w: slidePaneRef.current.clientWidth,
          h: slidePaneRef.current.clientHeight,
        });
      }
      if (scratchPaneRef.current) {
        setScratchBox({
          w: scratchPaneRef.current.clientWidth,
          h: scratchPaneRef.current.clientHeight,
        });
      }
    };
    updateSizes();

    const ro = new ResizeObserver(() => updateSizes());
    if (slidePaneRef.current) ro.observe(slidePaneRef.current);
    if (scratchPaneRef.current) ro.observe(scratchPaneRef.current);
    window.addEventListener('resize', updateSizes);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSizes);
    };
  }, [open, scratchMode, splitRatio]);

  // Splitter Dragging
  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => {
      if (!draggingSplitRef.current || !mainRowRef.current) return;
      const rect = mainRowRef.current.getBoundingClientRect();
      const rawRatio = (e.clientX - rect.left) / Math.max(1, rect.width);
      setSplitRatio(Math.max(0.32, Math.min(0.74, rawRatio)));
    };
    const onUp = () => {
      draggingSplitRef.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
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
      setSlideSelectedIds([]);
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

  // Auto-advance timer (`advTm`)
  useEffect(() => {
    if (!open || !current?.pptSlide?.transition.advanceAfterMs) return;
    const ms = current.pptSlide.transition.advanceAfterMs;
    const id = window.setTimeout(() => {
      handleNext();
    }, ms);
    return () => window.clearTimeout(id);
  }, [open, slideIdx, stepIdx, current, handleNext]);

  // Slide & Scratch Commit with Undo/Redo History
  const commitSlideElements = useCallback(
    (next: BoardElement[]) => {
      if (!current) return;
      const pid = current.page.id;
      setSlideUndoMap((prev) => ({
        ...prev,
        [pid]: [...(prev[pid] || []).slice(-39), current.page.elements],
      }));
      setSlideRedoMap((prev) => ({ ...prev, [pid]: [] }));
      onCommitPageElements(pid, next);
    },
    [current, onCommitPageElements]
  );

  const commitScratchElements = useCallback(
    (next: BoardElement[]) => {
      setScratchUndo((prev) => [...prev.slice(-39), scratchElements]);
      setScratchRedo([]);
      setScratchElements(next);
    },
    [scratchElements]
  );

  const handleUndoActive = useCallback(() => {
    if (!current) return;
    if (activeTarget === 'scratch' && scratchMode !== 'off') {
      if (scratchUndo.length === 0) return;
      const prev = scratchUndo[scratchUndo.length - 1];
      setScratchUndo((u) => u.slice(0, -1));
      setScratchRedo((r) => [scratchElements, ...r]);
      setScratchElements(prev);
      setScratchSelectedIds([]);
      return;
    }

    const pid = current.page.id;
    const past = slideUndoMap[pid] || [];
    if (past.length > 0) {
      const prev = past[past.length - 1];
      setSlideUndoMap((m) => ({ ...m, [pid]: past.slice(0, -1) }));
      setSlideRedoMap((m) => ({ ...m, [pid]: [current.page.elements, ...(m[pid] || [])] }));
      onCommitPageElements(pid, prev);
      setSlideSelectedIds([]);
      return;
    }

    // Fallback: remove last non-locked element
    const idxToRemove = [...current.page.elements]
      .reverse()
      .findIndex((el) => !(el.type === 'image' && el.locked));
    if (idxToRemove !== -1) {
      const realIdx = current.page.elements.length - 1 - idxToRemove;
      const next = [...current.page.elements];
      next.splice(realIdx, 1);
      onCommitPageElements(pid, next);
    }
  }, [
    current,
    activeTarget,
    scratchMode,
    scratchUndo,
    scratchElements,
    slideUndoMap,
    onCommitPageElements,
  ]);

  const handleRedoActive = useCallback(() => {
    if (!current) return;
    if (activeTarget === 'scratch' && scratchMode !== 'off') {
      if (scratchRedo.length === 0) return;
      const next = scratchRedo[0];
      setScratchRedo((r) => r.slice(1));
      setScratchUndo((u) => [...u, scratchElements]);
      setScratchElements(next);
      setScratchSelectedIds([]);
      return;
    }

    const pid = current.page.id;
    const fut = slideRedoMap[pid] || [];
    if (fut.length === 0) return;
    const next = fut[0];
    setSlideRedoMap((m) => ({ ...m, [pid]: fut.slice(1) }));
    setSlideUndoMap((m) => ({ ...m, [pid]: [...(m[pid] || []), current.page.elements] }));
    onCommitPageElements(pid, next);
    setSlideSelectedIds([]);
  }, [
    current,
    activeTarget,
    scratchMode,
    scratchRedo,
    scratchElements,
    slideRedoMap,
    onCommitPageElements,
  ]);

  const handleClearActive = useCallback(() => {
    if (!current) return;
    if (activeTarget === 'scratch' && scratchMode !== 'off') {
      commitScratchElements([]);
      setScratchSelectedIds([]);
      return;
    }
    const kept = current.page.elements.filter((el) => el.type === 'image' && el.locked);
    commitSlideElements(kept);
    setSlideSelectedIds([]);
  }, [current, activeTarget, scratchMode, commitScratchElements, commitSlideElements]);

  const setScratchModeSafe = useCallback(
    (nextMode: ScratchMode) => {
      setScratchMode(nextMode);
      if (nextMode !== 'off') {
        setActiveTarget('scratch');
        if (tool === 'pointer') {
          setTool('pen');
          if (scratchSurface !== 'blank' && penColor === '#0F172A') {
            setPenColor('#FFFFFF');
          }
        }
      } else {
        setActiveTarget('slide');
      }
    },
    [tool, scratchSurface, penColor]
  );

  // Keyboard shortcuts inside Presenter
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'F3') {
        e.preventDefault();
        onOsnapChange((prev) => ({
          ...prev,
          enabled: !prev.enabled,
          oneShot: null,
        }));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedoActive();
        else handleUndoActive();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedoActive();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeSel =
          activeTarget === 'scratch' && scratchMode !== 'off'
            ? scratchSelectedIds
            : slideSelectedIds;
        if (activeSel.length > 0) {
          e.preventDefault();
          if (activeTarget === 'scratch' && scratchMode !== 'off') {
            commitScratchElements(scratchElements.filter((el) => !activeSel.includes(el.id)));
            setScratchSelectedIds([]);
          } else if (current) {
            commitSlideElements(current.page.elements.filter((el) => !activeSel.includes(el.id)));
            setSlideSelectedIds([]);
          }
          return;
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (openMenu) setOpenMenu(null);
        else if (overviewOpen) setOverviewOpen(false);
        else if (scratchMode === 'full') setScratchModeSafe('side');
        else if (scratchMode === 'side') setScratchModeSafe('off');
        else onClose();
        return;
      }

      if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowDown' ||
        e.key === 'PageDown' ||
        e.key === ' ' ||
        e.key === 'Enter'
      ) {
        if (scratchMode !== 'full') {
          e.preventDefault();
          handleNext();
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Backspace') {
        if (scratchMode !== 'full') {
          e.preventDefault();
          handlePrev();
        }
        return;
      }

      const k = e.key.toLowerCase();
      if (k === '1' || k === 'm') setTool('pointer');
      else if (k === '2' || k === 'v') setTool('select');
      else if (k === '3' || k === 'p') setTool('pen');
      else if (k === '4' || k === 'h') setTool('highlighter');
      else if (k === '5' || k === 'e') setTool('eraser');
      else if (k === '6' || k === 's') setTool('shape');
      else if (k === '7' || k === 't') setTool('text');
      else if (k === '8' || k === 'l') setTool('laser');
      else if (k === 'b') {
        setScratchModeSafe(scratchMode === 'off' ? 'side' : 'off');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    open,
    openMenu,
    overviewOpen,
    scratchMode,
    activeTarget,
    scratchSelectedIds,
    slideSelectedIds,
    scratchElements,
    current,
    handleNext,
    handlePrev,
    handleUndoActive,
    handleRedoActive,
    commitScratchElements,
    commitSlideElements,
    setScratchModeSafe,
    onOsnapChange,
    onClose,
  ]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  // Compute rendered slide metrics inside left/center slide pane
  const slideMetrics = useMemo(() => {
    const sw = current?.width || 1600;
    const sh = current?.height || 900;
    const pad = scratchMode === 'side' ? 10 : 16;
    const availW = Math.max(200, slideBox.w - pad * 2);
    const availH = Math.max(160, slideBox.h - pad * 2);
    const scale = Math.min(availW / sw, availH / sh);
    return {
      slideW: sw,
      slideH: sh,
      scale,
      renderedW: Math.max(1, sw * scale),
      renderedH: Math.max(1, sh * scale),
    };
  }, [current, slideBox, scratchMode]);

  // Compute rendered scratchboard metrics (fills pane cleanly at crisp logical resolution)
  const scratchLogical = { w: 1200, h: 1200 };
  const scratchMetrics = useMemo(() => {
    const pad = 10;
    const availW = Math.max(180, scratchBox.w - pad * 2);
    const availH = Math.max(180, scratchBox.h - pad * 2);
    // Keep 1:1 pixel proportion with pane aspect ratio so user gets full height/width writing space!
    const aspect = availW / availH;
    const logicalH = 900;
    const logicalW = Math.max(480, Math.round(logicalH * aspect));
    return {
      logicalW,
      logicalH,
      renderedW: availW,
      renderedH: availH,
    };
  }, [scratchBox]);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore iframe restriction
    }
  };

  if (!open || !current) return null;

  const outgoingEntry = outgoing ? slideEntries[outgoing.index] : null;
  const trAnim = outgoing ? getTransitionKeyframes(outgoing.tr, outgoing.forward) : {};

  const isScratchTarget = activeTarget === 'scratch' && scratchMode !== 'off';
  const activeSelectionIds = isScratchTarget ? scratchSelectedIds : slideSelectedIds;
  const activeElementsList = isScratchTarget ? scratchElements : current.page.elements;
  const canUndo = isScratchTarget
    ? scratchUndo.length > 0
    : (slideUndoMap[current.page.id]?.length || 0) > 0 ||
      current.page.elements.some((el) => !(el.type === 'image' && el.locked));
  const canRedo = isScratchTarget
    ? scratchRedo.length > 0
    : (slideRedoMap[current.page.id]?.length || 0) > 0;
  const hasInkOnTarget = isScratchTarget
    ? scratchElements.length > 0
    : current.page.elements.some((el) => !(el.type === 'image' && el.locked));

  const restyleSelected = (patch: { color?: string; width?: number; lineStyle?: StrokeStyle }) => {
    if (activeSelectionIds.length === 0) return;
    const updater = (list: BoardElement[]) =>
      list.map((el) => {
        if (!activeSelectionIds.includes(el.id)) return el;
        if (el.type === 'stroke') {
          return {
            ...el,
            color: patch.color ?? el.color,
            width: patch.width ?? el.width,
            lineStyle: patch.lineStyle ?? el.lineStyle,
          };
        }
        if (el.type === 'shape') {
          const nextLs = patch.lineStyle ?? el.lineStyle ?? 'solid';
          return {
            ...el,
            strokeColor: patch.color ?? el.strokeColor,
            strokeWidth: patch.width ?? el.strokeWidth,
            lineStyle: nextLs,
            dashed: nextLs !== 'solid',
          };
        }
        if (el.type === 'text' && patch.color) {
          return { ...el, color: patch.color };
        }
        return el;
      });

    if (isScratchTarget) {
      commitScratchElements(updater(scratchElements));
    } else {
      commitSlideElements(updater(current.page.elements));
    }
  };

  const renderScratchPaneContent = (isFull: boolean) => (
    <div
      className={`h-full flex flex-col bg-[#11161F] ${
        isFull ? 'w-full' : 'border-l border-white/15'
      }`}
    >
      {/* Scratchboard Mini Header */}
      <div className="h-9 px-2.5 flex items-center justify-between gap-2 bg-slate-900/90 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 whitespace-nowrap">
            <Columns2 className="w-3.5 h-3.5" />
            Bảng nháp {isFull ? '(Toàn màn)' : '(Bên phải)'}
          </span>

          {/* Surface Picker */}
          <div className="flex items-center gap-0.5 bg-slate-800/90 p-0.5 rounded-lg border border-white/10">
            {(
              [
                { id: 'greenboard', label: 'Xanh', swatch: '#274C43' },
                { id: 'blank', label: 'Trắng', swatch: '#FFFFFF' },
                { id: 'chalkboard', label: 'Đen', swatch: '#1B2027' },
              ] as const
            ).map((sf) => (
              <button
                key={sf.id}
                type="button"
                onClick={() => setScratchSurface(sf.id)}
                className={`h-6 px-2 rounded-md text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                  scratchSurface === sf.id
                    ? 'bg-white/20 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs border border-white/25"
                  style={{ backgroundColor: sf.swatch }}
                />
                <span className="hidden sm:inline">{sf.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isFull ? (
            <button
              type="button"
              onClick={() => setScratchModeSafe('side')}
              title="Thu sang bên phải cạnh Slide"
              className="h-6 px-2 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-medium text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <Columns2 className="w-3 h-3" />
              Mở bên phải
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setScratchModeSafe('full')}
              title="Mở rộng toàn màn hình"
              className="h-6 px-2 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-medium text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              <span className="hidden xl:inline">Toàn màn</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              commitScratchElements([]);
              setScratchSelectedIds([]);
            }}
            disabled={scratchElements.length === 0}
            title="Xóa sạch bảng nháp"
            className="h-6 px-2 rounded-md bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 disabled:opacity-30 text-[10px] font-medium cursor-pointer"
          >
            Xóa
          </button>

          <button
            type="button"
            onClick={() => setScratchModeSafe('off')}
            title="Đóng bảng nháp"
            className="w-6 h-6 rounded-md hover:bg-white/15 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scratchboard Canvas Area */}
      <div
        ref={scratchPaneRef}
        className="relative flex-1 flex items-center justify-center p-2.5 overflow-hidden"
      >
        <div
          className={`rounded-lg overflow-hidden shadow-2xl border-2 transition-colors ${
            activeTarget === 'scratch' ? 'border-emerald-500/70' : 'border-white/15'
          }`}
        >
          <PresenterInteractiveCanvas
            logicalWidth={scratchMetrics.logicalW || scratchLogical.w}
            logicalHeight={scratchMetrics.logicalH || scratchLogical.h}
            renderedWidth={scratchMetrics.renderedW}
            renderedHeight={scratchMetrics.renderedH}
            elements={scratchElements}
            backgroundTemplate={scratchSurface}
            tool={tool === 'pointer' ? 'pen' : tool}
            selectMode={selectMode}
            penColor={penColor}
            penWidth={penWidth}
            penStyle={penStyle}
            hlColor={hlColor}
            hlWidth={hlWidth}
            hlOpacity={hlOpacity}
            hlMode={hlMode}
            hlStraight={hlStraight}
            eraserMode={eraserMode}
            eraserSize={eraserSize}
            activeShape={activeShape}
            shapeStrokeColor={shapeStrokeColor}
            shapeFillColor={shapeFillColor}
            shapeLineStyle={shapeLineStyle}
            shapeStrokeWidth={shapeStrokeWidth}
            inkToShape={inkToShape}
            stylusSettings={stylusSettings}
            osnap={osnap}
            onOsnapChange={onOsnapChange}
            selectedIds={scratchSelectedIds}
            onSelectedIdsChange={setScratchSelectedIds}
            onCommitElements={commitScratchElements}
            onActivateTarget={() => setActiveTarget('scratch')}
            onSelectShapeTool={(s) => {
              setActiveShape(s);
              setTool('shape');
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0D13] text-white flex flex-col select-none overflow-hidden">
      {/* Top Floating Micro Header */}
      <div className="h-11 px-3 sm:px-4 flex items-center justify-between bg-slate-950/80 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs sm:text-sm font-semibold text-white truncate max-w-[32vw]">
            {deckTitle}
          </span>
          <span className="text-[11px] font-mono-tabular text-slate-400 shrink-0">
            Slide {slideIdx + 1}/{totalSlides}
            {totalSteps > 0 ? ` · Hiệu ứng ${stepIdx}/${totalSteps}` : ''}
          </span>
          {osnap.enabled && (
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-medium text-emerald-300">
              <Magnet className="w-3 h-3" />
              {osnap.oneShot ? `1-lần: ${osnap.oneShot}` : 'OSNAP'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Scratchboard Mode Switcher right in Header */}
          <div className="hidden sm:flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10">
            <button
              type="button"
              onClick={() => setScratchModeSafe('off')}
              className={`h-6 px-2 rounded-md text-[10px] font-medium cursor-pointer transition-colors ${
                scratchMode === 'off' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Chỉ Slide
            </button>
            <button
              type="button"
              onClick={() => setScratchModeSafe('side')}
              title="Mở bảng nháp bên phải cạnh Slide (Phím B)"
              className={`h-6 px-2 rounded-md text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                scratchMode === 'side' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Columns2 className="w-3 h-3" />
              Nháp bên phải
            </button>
            <button
              type="button"
              onClick={() => setScratchModeSafe('full')}
              title="Mở bảng nháp toàn màn hình"
              className={`h-6 px-2 rounded-md text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                scratchMode === 'full' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <PanelBottom className="w-3 h-3" />
              Nháp toàn màn
            </button>
          </div>

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
              <span className="hidden lg:inline">Chạy lại</span>
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
              <span className="hidden lg:inline">Ghi chú</span>
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

      {/* Main Presentation Stage (Supports Full Slide, Side-by-Side Split with Right Scratchboard, or Full Scratchboard) */}
      <div ref={mainRowRef} className="relative flex-1 flex overflow-hidden">
        {/* Slide Stage Pane (visible when scratchMode !== 'full') */}
        {scratchMode !== 'full' && (
          <div
            ref={slidePaneRef}
            style={{
              width: scratchMode === 'side' ? `${splitRatio * 100}%` : '100%',
            }}
            className="relative h-full flex items-center justify-center overflow-hidden shrink-0"
          >
            <div
              style={{
                width: slideMetrics.renderedW,
                height: slideMetrics.renderedH,
              }}
              className={`relative rounded-md overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.65)] bg-white ${
                scratchMode === 'side' && activeTarget === 'slide' ? 'ring-2 ring-blue-500/70' : ''
              }`}
            >
              {/* Outgoing Slide Layer */}
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
                      transform: `scale(${slideMetrics.scale})`,
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

              {/* Active PPTX Slide Layer */}
              {current.pptSlide ? (
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
                      width: slideMetrics.slideW,
                      height: slideMetrics.slideH,
                      transform: `scale(${slideMetrics.scale})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    <PptxSlideStage
                      slide={current.pptSlide}
                      width={slideMetrics.slideW}
                      height={slideMetrics.slideH}
                      stepIndex={stepIdx}
                      justTriggeredStep={justTriggeredStep}
                      animNonce={animNonce}
                    />
                  </div>
                </div>
              ) : (
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

              {/* Interactive Full-Feature Whiteboard Overlay on Slide */}
              <div className="absolute inset-0 z-10">
                <PresenterInteractiveCanvas
                  logicalWidth={slideMetrics.slideW}
                  logicalHeight={slideMetrics.slideH}
                  renderedWidth={slideMetrics.renderedW}
                  renderedHeight={slideMetrics.renderedH}
                  elements={current.page.elements}
                  hideLockedImages={Boolean(current.pptSlide)}
                  tool={tool}
                  selectMode={selectMode}
                  penColor={penColor}
                  penWidth={penWidth}
                  penStyle={penStyle}
                  hlColor={hlColor}
                  hlWidth={hlWidth}
                  hlOpacity={hlOpacity}
                  hlMode={hlMode}
                  hlStraight={hlStraight}
                  eraserMode={eraserMode}
                  eraserSize={eraserSize}
                  activeShape={activeShape}
                  shapeStrokeColor={shapeStrokeColor}
                  shapeFillColor={shapeFillColor}
                  shapeLineStyle={shapeLineStyle}
                  shapeStrokeWidth={shapeStrokeWidth}
                  inkToShape={inkToShape}
                  stylusSettings={stylusSettings}
                  osnap={osnap}
                  onOsnapChange={onOsnapChange}
                  selectedIds={slideSelectedIds}
                  onSelectedIdsChange={setSlideSelectedIds}
                  onCommitElements={commitSlideElements}
                  onPointerAdvance={handleNext}
                  onActivateTarget={() => setActiveTarget('slide')}
                  onSelectShapeTool={(s) => {
                    setActiveShape(s);
                    setTool('shape');
                  }}
                />
              </div>
            </div>

            {/* Subtle Edge Nav Chevrons */}
            <button
              type="button"
              onClick={handlePrev}
              disabled={slideIdx === 0 && stepIdx === 0}
              title="Lùi bước / Slide trước (←)"
              className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-900/65 hover:bg-slate-900/90 border border-white/15 items-center justify-center text-white disabled:opacity-20 cursor-pointer transition-opacity z-20"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={slideIdx === totalSlides - 1 && stepIdx >= totalSteps}
              title="Hiệu ứng tiếp / Slide sau (→ / Space)"
              className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-900/65 hover:bg-slate-900/90 border border-white/15 items-center justify-center text-white disabled:opacity-20 cursor-pointer transition-opacity z-20"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Resizable Splitter Handle when Right Scratchboard is active */}
        {scratchMode === 'side' && (
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              draggingSplitRef.current = true;
            }}
            title="Kéo để thay đổi kích thước Slide / Bảng nháp"
            className="w-2 bg-slate-900 hover:bg-emerald-600/70 border-x border-white/10 cursor-col-resize flex items-center justify-center shrink-0 transition-colors z-20"
          >
            <div className="w-0.5 h-10 rounded-full bg-white/40" />
          </div>
        )}

        {/* Right Side Scratchboard Pane */}
        {scratchMode === 'side' && (
          <div className="flex-1 min-w-0 h-full">
            {renderScratchPaneContent(false)}
          </div>
        )}

        {/* Full-Screen Scratchboard Pane */}
        {scratchMode === 'full' && renderScratchPaneContent(true)}

        {/* Floating Quick Style Bar when objects are selected */}
        {tool === 'select' && activeSelectionIds.length > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-white/15 shadow-2xl">
            <span className="text-[11px] font-medium text-slate-300 pr-1">
              Đã chọn ({activeSelectionIds.length})
            </span>
            {QUICK_INK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => restyleSelected({ color: c })}
                className="w-4 h-4 rounded-full border border-white/30 cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                title="Đổi màu"
              />
            ))}
            <div className="w-px h-4 bg-white/15 mx-0.5" />
            {(
              [
                { id: 'solid', label: 'Liền' },
                { id: 'dashed', label: 'Đứt' },
                { id: 'dotted', label: 'Chấm' },
              ] as const
            ).map((ls) => (
              <button
                key={ls.id}
                type="button"
                onClick={() => restyleSelected({ lineStyle: ls.id })}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-blue-600 text-[10px] font-medium cursor-pointer"
              >
                {ls.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                if (isScratchTarget) {
                  commitScratchElements(
                    scratchElements.filter((el) => !activeSelectionIds.includes(el.id))
                  );
                  setScratchSelectedIds([]);
                } else {
                  commitSlideElements(
                    current.page.elements.filter((el) => !activeSelectionIds.includes(el.id))
                  );
                  setSlideSelectedIds([]);
                }
              }}
              className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[10px] font-medium cursor-pointer"
            >
              Xóa
            </button>
          </div>
        )}

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
          <div className="absolute inset-0 z-40 bg-slate-950/92 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
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
                        if (scratchMode === 'full') setScratchModeSafe('side');
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

      {/* Bottom Floating Full Presenter Toolbar + Upward Popovers */}
      <div className="relative px-2 pb-2 pt-1 flex justify-center shrink-0">
        {/* Upward Popover Layer */}
        {openMenu && (
          <div
            ref={popoverRef}
            className="fixed bottom-14 left-1/2 -translate-x-1/2 max-w-[calc(100vw-24px)] max-h-[65dvh] overflow-y-auto z-60 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-white/15 shadow-2xl p-3 text-white"
          >
            {openMenu === 'select' && (
              <div className="w-56 space-y-1">
                <div className="text-[11px] font-semibold text-slate-400 px-1 mb-1">
                  Kiểu vùng chọn
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectMode('lasso');
                    setOpenMenu(null);
                  }}
                  className={`w-full px-2.5 py-2 rounded-lg flex items-center gap-2 text-xs font-medium cursor-pointer ${
                    selectMode === 'lasso' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <Lasso className="w-4 h-4" />
                  Khoanh vùng tự do (Lasso)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectMode('box');
                    setOpenMenu(null);
                  }}
                  className={`w-full px-2.5 py-2 rounded-lg flex items-center gap-2 text-xs font-medium cursor-pointer ${
                    selectMode === 'box' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <MousePointer2 className="w-4 h-4" />
                  Quét khung chữ nhật
                </button>
              </div>
            )}

            {openMenu === 'pen' && (
              <div className="w-72 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">
                    {tool === 'pencil' ? 'Bút chì phác thảo' : 'Cấu hình Bút viết'}
                  </span>
                  <span className="text-[11px] font-mono-tabular text-slate-300">{penWidth} px</span>
                </div>

                {/* Line Style */}
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-800">
                  {(
                    [
                      { id: 'solid', label: 'Nét liền' },
                      { id: 'dashed', label: 'Nét đứt' },
                      { id: 'dotted', label: 'Nét chấm' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setPenStyle(st.id)}
                      className={`py-1.5 rounded-md text-[11px] font-medium cursor-pointer ${
                        penStyle === st.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Thickness presets & slider */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-5 gap-1">
                    {[2, 3.5, 5, 8, 12].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setPenWidth(w)}
                        className={`h-7 rounded border text-[10px] font-mono-tabular cursor-pointer ${
                          Math.abs(penWidth - w) < 0.4
                            ? 'border-blue-500 bg-blue-600/30 text-white'
                            : 'border-white/15 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={18}
                    step={0.5}
                    value={penWidth}
                    onChange={(e) => setPenWidth(parseFloat(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] cursor-pointer">
                  <span>Tự nắn hình học khi vẽ tay</span>
                  <input
                    type="checkbox"
                    checked={inkToShape}
                    onChange={(e) => setInkToShape(e.target.checked)}
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                  />
                </label>

                <ColorPalettePicker
                  color={penColor}
                  onChange={setPenColor}
                  customColors={customColors}
                  onAddCustomColor={onAddCustomColor}
                  onRemoveCustomColor={onRemoveCustomColor}
                />
              </div>
            )}

            {openMenu === 'highlighter' && (
              <div className="w-72 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Bút dạ quang &amp; Tô sáng</span>
                  <span className="text-[11px] font-mono-tabular text-slate-300">{hlWidth} px</span>
                </div>

                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-800">
                  {(
                    [
                      { id: 'pdf', label: 'Tô sáng', desc: 'Rõ chữ' },
                      { id: 'marker', label: 'Bôi màu', desc: 'Phủ đều' },
                      { id: 'block', label: 'Tô khung', desc: 'Hình khối' },
                    ] as const
                  ).map((hm) => (
                    <button
                      key={hm.id}
                      type="button"
                      onClick={() => {
                        setHlMode(hm.id);
                        setHlOpacity(hm.id === 'marker' ? 0.6 : 0.42);
                      }}
                      className={`py-1.5 px-1 rounded-md flex flex-col items-center cursor-pointer ${
                        hlMode === hm.id ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-[11px] leading-tight">{hm.label}</span>
                      <span className="text-[9px] opacity-80">{hm.desc}</span>
                    </button>
                  ))}
                </div>

                {hlMode !== 'block' && (
                  <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] cursor-pointer">
                    <span>Tô thẳng hàng ngang</span>
                    <input
                      type="checkbox"
                      checked={hlStraight}
                      onChange={(e) => setHlStraight(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>
                )}

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Cỡ đầu bút</span>
                    <span className="font-mono-tabular text-white">{hlWidth} px</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={48}
                    step={2}
                    value={hlWidth}
                    onChange={(e) => setHlWidth(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Độ đậm màu</span>
                    <span className="font-mono-tabular text-white">{Math.round(hlOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.15}
                    max={0.95}
                    step={0.05}
                    value={hlOpacity}
                    onChange={(e) => setHlOpacity(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <ColorPalettePicker
                  color={hlColor}
                  onChange={setHlColor}
                  customColors={customColors}
                  onAddCustomColor={onAddCustomColor}
                  onRemoveCustomColor={onRemoveCustomColor}
                />
              </div>
            )}

            {openMenu === 'eraser' && (
              <div className="w-60 space-y-3">
                <div className="text-[11px] font-semibold text-slate-400">Chế độ tẩy</div>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setEraserMode('stroke')}
                    className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                      eraserMode === 'stroke' ? 'bg-blue-600 text-white' : 'text-slate-300'
                    }`}
                  >
                    Tẩy cả nét
                  </button>
                  <button
                    type="button"
                    onClick={() => setEraserMode('partial')}
                    className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                      eraserMode === 'partial' ? 'bg-blue-600 text-white' : 'text-slate-300'
                    }`}
                  >
                    Tẩy từng đoạn
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Kích thước đầu tẩy</span>
                    <span className="font-mono-tabular text-white">{eraserSize} px</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={64}
                    value={eraserSize}
                    onChange={(e) => setEraserSize(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleClearActive();
                    setOpenMenu(null);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isScratchTarget ? 'Xóa sạch Bảng nháp' : 'Xóa mực trên Slide này'}
                </button>
              </div>
            )}

            {openMenu === 'shape' && (
              <div className="w-76 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Hình học &amp; Vẽ kỹ thuật</span>
                  <span className="text-[10px] text-emerald-400">Shift: 8 góc · Chuột phải: OSNAP</span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {SHAPE_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      title={s.label}
                      onClick={() => {
                        setActiveShape(s.id);
                        setTool('shape');
                      }}
                      className={`h-9 rounded-lg flex items-center justify-center border cursor-pointer transition-colors ${
                        activeShape === s.id
                          ? 'border-blue-500 bg-blue-600/30 text-white'
                          : 'border-white/15 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {s.icon}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-800">
                  {(
                    [
                      { id: 'solid', label: 'Nét liền' },
                      { id: 'dashed', label: 'Nét đứt' },
                      { id: 'dotted', label: 'Nét chấm' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setShapeLineStyle(st.id)}
                      className={`py-1.5 rounded-md text-[11px] font-medium cursor-pointer ${
                        shapeLineStyle === st.id ? 'bg-blue-600 text-white' : 'text-slate-300'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Độ dày viền</span>
                    <span className="font-mono-tabular text-white">{shapeStrokeWidth} px</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={16}
                    step={0.5}
                    value={shapeStrokeWidth}
                    onChange={(e) => setShapeStrokeWidth(parseFloat(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setShapeColorTab('stroke')}
                    className={`py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1.5 cursor-pointer ${
                      shapeColorTab === 'stroke' ? 'bg-slate-950 text-white' : 'text-slate-400'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-white/25"
                      style={{ backgroundColor: shapeStrokeColor }}
                    />
                    Màu viền
                  </button>
                  <button
                    type="button"
                    onClick={() => setShapeColorTab('fill')}
                    className={`py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1.5 cursor-pointer ${
                      shapeColorTab === 'fill' ? 'bg-slate-950 text-white' : 'text-slate-400'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-white/25"
                      style={{
                        backgroundColor: shapeFillColor === 'transparent' ? '#ffffff' : shapeFillColor,
                      }}
                    />
                    Màu tô nền
                  </button>
                </div>

                {shapeColorTab === 'stroke' ? (
                  <ColorPalettePicker
                    color={shapeStrokeColor}
                    onChange={setShapeStrokeColor}
                    customColors={customColors}
                    onAddCustomColor={onAddCustomColor}
                    onRemoveCustomColor={onRemoveCustomColor}
                  />
                ) : (
                  <ColorPalettePicker
                    color={shapeFillColor}
                    onChange={setShapeFillColor}
                    customColors={customColors}
                    onAddCustomColor={onAddCustomColor}
                    onRemoveCustomColor={onRemoveCustomColor}
                    allowTransparent
                  />
                )}
              </div>
            )}

            {openMenu === 'osnap' && (
              <div className="w-68 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Magnet className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold">Bắt điểm CAD (OSNAP)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onOsnapChange((prev) => ({
                        ...prev,
                        enabled: !prev.enabled,
                        oneShot: null,
                      }))
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                      osnap.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {osnap.enabled ? 'ĐANG BẬT (F3)' : 'ĐÃ TẮT (F3)'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onOsnapChange({
                        enabled: true,
                        oneShot: null,
                        modes: {
                          endpoint: true,
                          midpoint: true,
                          center: true,
                          quadrant: true,
                          intersection: true,
                          perpendicular: true,
                          tangent: true,
                          nearest: false,
                        },
                      })
                    }
                    className="py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-medium cursor-pointer"
                  >
                    Chuẩn CAD
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOsnapChange({
                        enabled: true,
                        oneShot: null,
                        modes: {
                          endpoint: true,
                          midpoint: true,
                          center: true,
                          quadrant: true,
                          intersection: true,
                          perpendicular: true,
                          tangent: true,
                          nearest: true,
                        },
                      })
                    }
                    className="py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-medium cursor-pointer"
                  >
                    Bật tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOsnapChange((prev) => ({ ...prev, enabled: false, oneShot: null }))
                    }
                    className="py-1 rounded-lg bg-white/10 hover:bg-rose-500/30 text-[10px] font-medium cursor-pointer"
                  >
                    Tắt hết
                  </button>
                </div>

                <div className="space-y-0.5 max-h-56 overflow-y-auto">
                  {OSNAP_META.map((item) => {
                    const checked = osnap.enabled && osnap.modes[item.type];
                    const isOneShot = osnap.oneShot === item.type;
                    return (
                      <div
                        key={item.type}
                        className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg ${
                          isOneShot ? 'bg-emerald-950/70 border border-emerald-500/60' : 'hover:bg-white/10'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onOsnapChange((prev) => {
                              const nextVal = !prev.modes[item.type];
                              return {
                                enabled: nextVal ? true : prev.enabled,
                                oneShot: null,
                                modes: { ...prev.modes, [item.type]: nextVal },
                              };
                            })
                          }
                          className="flex-1 flex items-center gap-2 text-left cursor-pointer"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-[11px] font-medium">{item.label}</span>
                          {checked && <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto shrink-0" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (item.type === 'tangent' && !isLinearShapeType(activeShape)) {
                              setActiveShape('line');
                            }
                            setTool('shape');
                            onOsnapChange((prev) => ({
                              ...prev,
                              enabled: true,
                              oneShot: item.type as SnapType,
                            }));
                            setOpenMenu(null);
                          }}
                          className="px-1.5 py-0.5 rounded bg-white/15 hover:bg-blue-600 text-[9px] font-semibold cursor-pointer shrink-0"
                        >
                          Chỉ bắt
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[10px] text-slate-400 border-t border-white/10 pt-1">
                  Mẹo: Nhấn <strong>Shift + Chuột phải</strong> trực tiếp trên slide hoặc bảng nháp để mở menu bắt điểm nhanh.
                </div>
              </div>
            )}
          </div>
        )}

        {!dockVisible ? (
          <button
            type="button"
            onClick={() => setDockVisible(true)}
            className="h-8 px-3 rounded-full bg-slate-900/90 border border-white/15 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            Hiện thanh trình chiếu &amp; công cụ
          </button>
        ) : (
          <div
            ref={dockRef}
            className="flex items-center gap-1 rounded-2xl bg-slate-900/95 border border-white/15 px-2.5 py-1.5 shadow-2xl max-w-full overflow-x-auto no-scrollbar"
          >
            {/* Slide Navigation */}
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
              title="Xem lưới tất cả Slide"
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
              title="Hiệu ứng tiếp / Slide sau"
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 cursor-pointer shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-white/15 mx-0.5 shrink-0" />

            {/* Full Integrated Toolbar */}
            {(
              [
                {
                  id: 'pointer',
                  label: 'Chạy',
                  title: 'Trình chiếu (Nhấp slide để chạy hiệu ứng - Phím 1)',
                  icon: <MousePointer2 className="w-4 h-4" />,
                },
                {
                  id: 'select',
                  label: 'Chọn',
                  title: 'Khoanh vùng / Chọn & Di chuyển (Phím 2 / V)',
                  icon: selectMode === 'lasso' ? <Lasso className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4" />,
                  menu: 'select' as const,
                },
                {
                  id: 'pen',
                  label: 'Bút',
                  title: 'Bút viết nét liền/đứt/chấm (Phím 3 / P)',
                  icon: <Pen className="w-4 h-4" />,
                  menu: 'pen' as const,
                },
                {
                  id: 'pencil',
                  label: 'Chì',
                  title: 'Bút chì phác thảo',
                  icon: <Pencil className="w-4 h-4" />,
                  menu: 'pen' as const,
                },
                {
                  id: 'highlighter',
                  label: 'Dạ quang',
                  title: 'Bút dạ quang tô sáng (Phím 4 / H)',
                  icon: <Highlighter className="w-4 h-4" />,
                  menu: 'highlighter' as const,
                },
                {
                  id: 'eraser',
                  label: 'Tẩy',
                  title: 'Tẩy nét / Tẩy từng đoạn (Phím 5 / E)',
                  icon: <Eraser className="w-4 h-4" />,
                  menu: 'eraser' as const,
                },
                {
                  id: 'shape',
                  label: 'Hình',
                  title: 'Hình học & Kỹ thuật (Shift: 8 góc, Shift+Chuột phải: OSNAP - Phím 6 / S)',
                  icon: <Shapes className="w-4 h-4" />,
                  menu: 'shape' as const,
                },
                {
                  id: 'text',
                  label: 'Chữ',
                  title: 'Chèn chữ trực tiếp (Phím 7 / T)',
                  icon: <Type className="w-4 h-4" />,
                },
                {
                  id: 'laser',
                  label: 'Laser',
                  title: 'Đèn Laser đỏ trình chiếu (Phím 8 / L)',
                  icon: <Flame className="w-4 h-4" />,
                },
              ] as const
            ).map((item) => {
              const active = tool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.title}
                  onClick={() => {
                    if ('menu' in item && item.menu) {
                      if (active) {
                        setOpenMenu((prev) => (prev === item.menu ? null : item.menu));
                      } else {
                        setTool(item.id);
                        setOpenMenu(item.menu);
                      }
                    } else {
                      setTool(item.id);
                      setOpenMenu(null);
                    }
                  }}
                  className={`relative h-8 px-2 rounded-lg flex items-center gap-1 text-xs font-medium cursor-pointer shrink-0 transition-colors whitespace-nowrap ${
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
                  <span className="hidden xl:inline">{item.label}</span>
                  {'menu' in item && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        active ? 'bg-white/90' : 'bg-slate-400/70'
                      }`}
                    />
                  )}
                </button>
              );
            })}

            {/* Quick Pen Color Dots when Pen/Pencil is active */}
            {(tool === 'pen' || tool === 'pencil') && (
              <div className="hidden md:flex items-center gap-1 pl-1 ml-0.5 border-l border-white/15 shrink-0">
                {QUICK_INK_COLORS.slice(0, 4).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPenColor(c)}
                    className={`w-4.5 h-4.5 rounded-full border cursor-pointer ${
                      penColor === c ? 'ring-2 ring-white border-white scale-110' : 'border-white/30'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}

            <div className="w-px h-5 bg-white/15 mx-0.5 shrink-0" />

            {/* CAD OSNAP Toggle + Dropdown */}
            <div className="flex items-center rounded-lg bg-white/5 border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onOsnapChange((prev) => ({
                    ...prev,
                    enabled: !prev.enabled,
                    oneShot: null,
                  }))
                }
                title="Bật/Tắt bắt điểm CAD (OSNAP - Phím F3)"
                className={`h-8 px-2 rounded-l-lg flex items-center gap-1 text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                  osnap.enabled || osnap.oneShot
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                <Magnet className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">OSNAP</span>
              </button>
              <button
                type="button"
                onClick={() => setOpenMenu((prev) => (prev === 'osnap' ? null : 'osnap'))}
                title="Chọn các chế độ bắt điểm CAD"
                className="h-8 px-1 rounded-r-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            <div className="w-px h-5 bg-white/15 mx-0.5 shrink-0" />

            {/* Undo / Redo / Clear */}
            <button
              type="button"
              onClick={handleUndoActive}
              disabled={!canUndo}
              title={`Hoàn tác trên ${isScratchTarget ? 'Bảng nháp' : 'Slide'} (Ctrl+Z)`}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 cursor-pointer shrink-0"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleRedoActive}
              disabled={!canRedo}
              title="Làm lại (Ctrl+Y)"
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 cursor-pointer shrink-0"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleClearActive}
              disabled={!hasInkOnTarget}
              title={isScratchTarget ? 'Xóa sạch Bảng nháp' : 'Xóa mực trên Slide này'}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-500/20 disabled:opacity-30 cursor-pointer shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Quick Side-by-Side Scratchboard Button */}
            <button
              type="button"
              onClick={() => setScratchModeSafe(scratchMode === 'side' ? 'off' : 'side')}
              title="Mở/Đóng Bảng nháp bên phải cạnh Slide (Phím B)"
              className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium cursor-pointer shrink-0 whitespace-nowrap transition-colors ${
                scratchMode !== 'off'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 text-slate-200 hover:bg-white/15'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bảng nháp</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                setDockVisible(false);
              }}
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

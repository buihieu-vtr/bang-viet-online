import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Magnet } from 'lucide-react';
import {
  BoardElement,
  EraserMode,
  HighlightMode,
  OsnapSettings,
  PaperTemplate,
  Point,
  SelectMode,
  ShapeItem,
  ShapeType,
  SnapType,
  StrokeItem,
  StrokeStyle,
  StylusSettings,
  TextItem,
} from '../types/inkboard';
import {
  bboxesIntersect,
  dist,
  eraseStrokePartial,
  getCombinedBBox,
  getElementBBox,
  hitTestElement,
  pointInPolygon,
  recognizeInkShape,
  scaleElementInBox,
  translateElement,
  uid,
} from '../utils/geometry';
import {
  EllipseSnapInfo,
  findBestOsnap,
  isLinearShapeType,
  OSNAP_META,
  renderAngleHud,
  renderOsnapMarker,
  resolveDeferredTangentStart,
  SnapCandidate,
  solveCommonTangent,
} from '../utils/osnap';
import {
  drawRealisticBoardSurface,
  drawTemplatePattern,
  getTemplateColors,
  isDarkBoardTemplate,
  LaserPoint,
  renderElement,
  renderLaserTrail,
  renderShape,
  renderStroke,
} from '../utils/renderer';

export type PresenterTool =
  | 'pointer'
  | 'select'
  | 'pen'
  | 'pencil'
  | 'highlighter'
  | 'eraser'
  | 'shape'
  | 'text'
  | 'laser';

const PEN_CURSOR_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path d="M2 16 L4.0 11.4 L12.6 2.8 C13.2 2.2 14.1 2.2 14.7 2.8 L15.2 3.3 C15.8 3.9 15.8 4.8 15.2 5.4 L6.6 14.0 Z" fill="#1E293B" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/><path d="M4.0 11.4 L6.6 14.0 L4.3 15.1 L2.9 13.7 Z" fill="#F8FAFC" stroke="#1E293B" stroke-width="0.7" stroke-linejoin="round"/><path d="M2 16 L2.9 13.7 L4.3 15.1 Z" fill="#0F172A"/><path d="M11.1 4.3 L13.7 6.9" stroke="#38BDF8" stroke-width="1.4" stroke-linecap="round"/></svg>`
);
const PEN_SVG_CURSOR = `url("data:image/svg+xml,${PEN_CURSOR_SVG}") 2 16, crosshair`;

type InteractionState =
  | { type: 'none' }
  | {
      type: 'draw';
      stroke: StrokeItem;
      lastRawX: number;
      lastRawY: number;
      lastPressure: number;
    }
  | {
      type: 'shape';
      shape: ShapeItem;
      startX: number;
      startY: number;
      deferredEllipse?: EllipseSnapInfo;
      deferredAnchor?: { x: number; y: number };
    }
  | { type: 'eraseStroke'; items: BoardElement[]; dirty: boolean }
  | { type: 'erasePartial'; items: BoardElement[]; dirty: boolean }
  | { type: 'lasso'; points: { x: number; y: number }[] }
  | { type: 'boxSelect'; x0: number; y0: number; x1: number; y1: number }
  | {
      type: 'moveSelected';
      startX: number;
      startY: number;
      origElements: BoardElement[];
      previewElements: BoardElement[];
    }
  | {
      type: 'resizeSelected';
      origBox: { x: number; y: number; width: number; height: number };
      origElements: BoardElement[];
      previewElements: BoardElement[];
    };

interface PresenterInteractiveCanvasProps {
  logicalWidth: number;
  logicalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  elements: BoardElement[];
  hideLockedImages?: boolean;
  backgroundTemplate?: PaperTemplate;
  tool: PresenterTool;
  selectMode: SelectMode;
  penColor: string;
  penWidth: number;
  penStyle: StrokeStyle;
  hlColor: string;
  hlWidth: number;
  hlOpacity: number;
  hlMode: HighlightMode;
  hlStraight: boolean;
  eraserMode: EraserMode;
  eraserSize: number;
  activeShape: ShapeType;
  shapeStrokeColor: string;
  shapeFillColor: string;
  shapeLineStyle: StrokeStyle;
  shapeStrokeWidth: number;
  inkToShape: boolean;
  stylusSettings: StylusSettings;
  osnap: OsnapSettings;
  onOsnapChange: React.Dispatch<React.SetStateAction<OsnapSettings>>;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onCommitElements: (next: BoardElement[]) => void;
  onPointerAdvance?: () => void;
  onActivateTarget?: () => void;
  onSelectShapeTool?: (shape: ShapeType) => void;
}

export const PresenterInteractiveCanvas: React.FC<PresenterInteractiveCanvasProps> = ({
  logicalWidth,
  logicalHeight,
  renderedWidth,
  renderedHeight,
  elements,
  hideLockedImages = false,
  backgroundTemplate,
  tool,
  selectMode,
  penColor,
  penWidth,
  penStyle,
  hlColor,
  hlWidth,
  hlOpacity,
  hlMode,
  hlStraight,
  eraserMode,
  eraserSize,
  activeShape,
  shapeStrokeColor,
  shapeFillColor,
  shapeLineStyle,
  shapeStrokeWidth,
  inkToShape,
  stylusSettings,
  osnap,
  onOsnapChange,
  selectedIds,
  onSelectedIdsChange,
  onCommitElements,
  onPointerAdvance,
  onActivateTarget,
  onSelectShapeTool,
}) => {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const interactionRef = useRef<InteractionState>({ type: 'none' });
  const activePointerIdRef = useRef<number | null>(null);
  const cursorPtRef = useRef<{ x: number; y: number } | null>(null);
  const osnapCandidateRef = useRef<SnapCandidate | null>(null);
  const shiftAngleLineRef = useRef(false);
  const laserPointsRef = useRef<LaserPoint[]>([]);
  const laserRafRef = useRef(0);

  const [osnapMenu, setOsnapMenu] = useState<{ x: number; y: number } | null>(null);
  const osnapMenuRef = useRef<HTMLDivElement>(null);

  const [editingText, setEditingText] = useState<{
    elementId: string;
    draft: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    color: string;
  } | null>(null);

  const scale = renderedWidth / Math.max(1, logicalWidth);

  const visibleSnappableElements = useCallback(
    () =>
      hideLockedImages
        ? elements.filter((el) => !(el.type === 'image' && el.locked))
        : elements,
    [elements, hideLockedImages]
  );

  // Close OSNAP menu on outside click
  useEffect(() => {
    if (!osnapMenu) return;
    const onDown = (ev: MouseEvent) => {
      if (osnapMenuRef.current && !osnapMenuRef.current.contains(ev.target as Node)) {
        setOsnapMenu(null);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [osnapMenu]);

  // Draw Base Canvas (Optional Scratchboard surface + committed/preview elements)
  const drawBase = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, Math.round(renderedWidth * dpr));
    const ch = Math.max(1, Math.round(renderedHeight * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr * scale, dpr * scale);

    if (backgroundTemplate) {
      const tpl = getTemplateColors(backgroundTemplate);
      drawRealisticBoardSurface(ctx, backgroundTemplate, 0, 0, logicalWidth, logicalHeight);
      drawTemplatePattern(ctx, backgroundTemplate, tpl.line, 40, 0, 0, logicalWidth, logicalHeight);
    }

    const mode = interactionRef.current;
    const listToRender =
      mode.type === 'eraseStroke' || mode.type === 'erasePartial'
        ? mode.items
        : mode.type === 'moveSelected' || mode.type === 'resizeSelected'
          ? mode.previewElements
          : elements;

    for (const el of listToRender) {
      if (hideLockedImages && el.type === 'image' && el.locked) continue;
      if (editingText && el.id === editingText.elementId) continue;
      renderElement(ctx, el, imageCacheRef.current, () => drawBase());
    }

    ctx.restore();
  }, [
    renderedWidth,
    renderedHeight,
    scale,
    backgroundTemplate,
    logicalWidth,
    logicalHeight,
    elements,
    hideLockedImages,
    editingText,
  ]);

  // Draw Overlay Canvas (Live stroke/shape, OSNAP marker, Angle HUD, Selection box, Eraser ring, Laser)
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, Math.round(renderedWidth * dpr));
    const ch = Math.max(1, Math.round(renderedHeight * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr * scale, dpr * scale);

    const mode = interactionRef.current;

    if (mode.type === 'draw') {
      renderStroke(ctx, mode.stroke, true);
    }

    if (mode.type === 'shape') {
      renderShape(ctx, mode.shape);
      if (isLinearShapeType(mode.shape.shapeType)) {
        renderAngleHud(
          ctx,
          mode.shape.x,
          mode.shape.y,
          mode.shape.x + mode.shape.width,
          mode.shape.y + mode.shape.height,
          scale,
          shiftAngleLineRef.current
        );
      }
    }

    if (osnapCandidateRef.current && (tool === 'shape' || mode.type === 'shape')) {
      renderOsnapMarker(ctx, osnapCandidateRef.current, scale);
    }

    if (mode.type === 'lasso' && mode.points.length >= 2) {
      ctx.save();
      ctx.strokeStyle = '#2563EB';
      ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
      ctx.lineWidth = 1.6 / scale;
      ctx.setLineDash([5 / scale, 4 / scale]);
      ctx.beginPath();
      ctx.moveTo(mode.points[0].x, mode.points[0].y);
      for (let i = 1; i < mode.points.length; i++) {
        ctx.lineTo(mode.points[i].x, mode.points[i].y);
      }
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }

    if (mode.type === 'boxSelect') {
      const rx = Math.min(mode.x0, mode.x1);
      const ry = Math.min(mode.y0, mode.y1);
      const rw = Math.abs(mode.x1 - mode.x0);
      const rh = Math.abs(mode.y1 - mode.y0);
      ctx.save();
      ctx.strokeStyle = '#2563EB';
      ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
      ctx.lineWidth = 1.6 / scale;
      ctx.setLineDash([5 / scale, 4 / scale]);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }

    // Selection bounding box & resize handle
    if (selectedIds.length > 0 && tool === 'select') {
      const sourceList =
        mode.type === 'moveSelected' || mode.type === 'resizeSelected'
          ? mode.previewElements
          : elements;
      const selectedEls = sourceList.filter((el) => selectedIds.includes(el.id));
      const box = getCombinedBBox(selectedEls);
      if (box) {
        ctx.save();
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1.8 / scale;
        ctx.setLineDash([5 / scale, 3 / scale]);
        ctx.strokeRect(box.x - 4 / scale, box.y - 4 / scale, box.width + 8 / scale, box.height + 8 / scale);
        ctx.setLineDash([]);
        // Bottom-right resize handle
        const hs = 9 / scale;
        const hx = box.x + box.width + 4 / scale;
        const hy = box.y + box.height + 4 / scale;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2 / scale;
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
        ctx.restore();
      }
    }

    // Eraser cursor ring
    if (tool === 'eraser' && cursorPtRef.current) {
      ctx.save();
      ctx.strokeStyle = '#EF4444';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      ctx.lineWidth = 1.5 / scale;
      ctx.beginPath();
      ctx.arc(cursorPtRef.current.x, cursorPtRef.current.y, eraserSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Laser trail
    const now = performance.now();
    laserPointsRef.current = laserPointsRef.current.filter((lp) => now - lp.t < 850);
    if (laserPointsRef.current.length >= 2) {
      renderLaserTrail(ctx, laserPointsRef.current, now, 850);
    }

    ctx.restore();
  }, [renderedWidth, renderedHeight, scale, tool, selectedIds, elements, eraserSize]);

  useEffect(() => {
    drawBase();
    drawOverlay();
  }, [drawBase, drawOverlay]);

  const startLaserLoop = useCallback(() => {
    if (laserRafRef.current) return;
    const tick = () => {
      const now = performance.now();
      laserPointsRef.current = laserPointsRef.current.filter((lp) => now - lp.t < 850);
      drawOverlay();
      if (laserPointsRef.current.length > 0) {
        laserRafRef.current = requestAnimationFrame(tick);
      } else {
        laserRafRef.current = 0;
      }
    };
    laserRafRef.current = requestAnimationFrame(tick);
  }, [drawOverlay]);

  useEffect(() => {
    return () => {
      if (laserRafRef.current) cancelAnimationFrame(laserRafRef.current);
    };
  }, []);

  const toLogicalPoint = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * logicalWidth,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * logicalHeight,
    };
  };

  const commitInlineText = () => {
    if (!editingText) return;
    const trimmed = editingText.draft.trimEnd();
    if (!trimmed) {
      const filtered = elements.filter((e) => e.id !== editingText.elementId);
      if (filtered.length !== elements.length) {
        onCommitElements(filtered);
      }
      setEditingText(null);
      return;
    }

    const exists = elements.some((e) => e.id === editingText.elementId);
    const nextItem: TextItem = {
      id: editingText.elementId,
      type: 'text',
      x: editingText.x,
      y: editingText.y,
      width: Math.max(180, editingText.width),
      height: Math.max(48, editingText.height),
      rotation: 0,
      text: trimmed,
      fontSize: editingText.fontSize,
      fontFamily: '"DM Sans", sans-serif',
      color: editingText.color,
      bold: false,
      italic: false,
      align: 'left',
      bgColor: 'transparent',
    };

    if (exists) {
      onCommitElements(elements.map((e) => (e.id === editingText.elementId ? nextItem : e)));
    } else {
      onCommitElements([...elements, nextItem]);
    }
    setEditingText(null);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (osnapMenu && e.button === 0) {
      setOsnapMenu(null);
    }
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Stylus-only / Gaomon pre-contact threshold guard
    if (stylusSettings.stylusOnly && e.pointerType === 'touch') return;
    if (
      e.pointerType === 'pen' &&
      stylusSettings.activationThreshold > 0 &&
      e.pressure > 0 &&
      e.pressure < stylusSettings.activationThreshold
    ) {
      return;
    }

    onActivateTarget?.();

    if (editingText) {
      commitInlineText();
      return;
    }

    if (tool === 'pointer') {
      onPointerAdvance?.();
      return;
    }

    const pt = toLogicalPoint(e.clientX, e.clientY);
    cursorPtRef.current = pt;

    if (tool === 'text') {
      const darkDefault = backgroundTemplate && isDarkBoardTemplate(backgroundTemplate);
      const textColor =
        darkDefault && penColor === '#0F172A'
          ? '#F8FAFC'
          : !darkDefault && penColor === '#FFFFFF'
            ? '#0F172A'
            : penColor;
      setEditingText({
        elementId: uid('txt'),
        draft: '',
        x: Math.max(20, Math.min(logicalWidth - 260, pt.x)),
        y: Math.max(20, Math.min(logicalHeight - 90, pt.y)),
        width: 280,
        height: 80,
        fontSize: 28,
        color: textColor,
      });
      return;
    }

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    activePointerIdRef.current = e.pointerId;

    if (tool === 'laser') {
      laserPointsRef.current.push({ x: pt.x, y: pt.y, t: performance.now() });
      startLaserLoop();
      return;
    }

    if (tool === 'select') {
      // 1. Check resize handle if we have a selection
      if (selectedIds.length > 0) {
        const selectedEls = elements.filter((el) => selectedIds.includes(el.id));
        const box = getCombinedBBox(selectedEls);
        if (box) {
          const hx = box.x + box.width + 4 / scale;
          const hy = box.y + box.height + 4 / scale;
          if (dist(pt, { x: hx, y: hy }) <= 14 / scale) {
            interactionRef.current = {
              type: 'resizeSelected',
              origBox: box,
              origElements: elements,
              previewElements: elements,
            };
            return;
          }
          if (
            pt.x >= box.x - 4 / scale &&
            pt.x <= box.x + box.width + 4 / scale &&
            pt.y >= box.y - 4 / scale &&
            pt.y <= box.y + box.height + 4 / scale
          ) {
            interactionRef.current = {
              type: 'moveSelected',
              startX: pt.x,
              startY: pt.y,
              origElements: elements,
              previewElements: elements,
            };
            return;
          }
        }
      }

      // 2. Hit test top-most non-locked element
      const hit = [...elements]
        .reverse()
        .find((el) => !(hideLockedImages && el.type === 'image' && el.locked) && hitTestElement(el, pt, 10 / scale));
      if (hit) {
        const nextSel = selectedIds.includes(hit.id) ? selectedIds : [hit.id];
        onSelectedIdsChange(nextSel);
        interactionRef.current = {
          type: 'moveSelected',
          startX: pt.x,
          startY: pt.y,
          origElements: elements,
          previewElements: elements,
        };
        drawOverlay();
        return;
      }

      // 3. Start Lasso or Box select
      onSelectedIdsChange([]);
      if (selectMode === 'lasso') {
        interactionRef.current = { type: 'lasso', points: [pt] };
      } else {
        interactionRef.current = { type: 'boxSelect', x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
      }
      drawOverlay();
      return;
    }

    if (tool === 'eraser') {
      if (eraserMode === 'stroke') {
        const next = elements.filter(
          (el) => (hideLockedImages && el.type === 'image' && el.locked) || !hitTestElement(el, pt, eraserSize / 2)
        );
        const dirty = next.length !== elements.length;
        interactionRef.current = { type: 'eraseStroke', items: next, dirty };
        if (dirty) drawBase();
      } else {
        const next: BoardElement[] = [];
        for (const el of elements) {
          if (el.type === 'stroke') {
            next.push(...eraseStrokePartial(el, pt, eraserSize / 2));
          } else {
            next.push(el);
          }
        }
        interactionRef.current = { type: 'erasePartial', items: next, dirty: true };
        drawBase();
      }
      drawOverlay();
      return;
    }

    if (tool === 'shape') {
      const startSnap = findBestOsnap(
        visibleSnappableElements(),
        pt,
        null,
        osnap,
        10 / scale,
        { drawingShapeType: activeShape }
      );
      const sx = startSnap ? startSnap.x : pt.x;
      const sy = startSnap ? startSnap.y : pt.y;
      osnapCandidateRef.current = startSnap;
      shiftAngleLineRef.current = false;

      const shape: ShapeItem = {
        id: uid('shape'),
        type: 'shape',
        shapeType: activeShape,
        x: sx,
        y: sy,
        width: 1,
        height: 1,
        rotation: 0,
        strokeColor: shapeStrokeColor,
        fillColor: shapeFillColor,
        fillOpacity: shapeFillColor === 'transparent' ? 0 : 0.25,
        strokeWidth: shapeStrokeWidth,
        lineStyle: shapeLineStyle,
        dashed: shapeLineStyle !== 'solid',
        rows: 3,
        cols: 3,
      };
      interactionRef.current = {
        type: 'shape',
        shape,
        startX: sx,
        startY: sy,
        deferredEllipse: isLinearShapeType(activeShape) ? startSnap?.deferredEllipse : undefined,
        deferredAnchor:
          isLinearShapeType(activeShape) && startSnap?.deferredEllipse ? { x: sx, y: sy } : undefined,
      };
      if (selectedIds.length > 0) onSelectedIdsChange([]);
      drawOverlay();
      return;
    }

    // Pen / Pencil / Highlighter
    const isHl = tool === 'highlighter';
    const isDarkSurface = backgroundTemplate && isDarkBoardTemplate(backgroundTemplate);
    const resolvedPenColor =
      isDarkSurface && penColor === '#0F172A'
        ? '#FFFFFF'
        : !isDarkSurface && backgroundTemplate === 'blank' && penColor === '#FFFFFF'
          ? '#0F172A'
          : penColor;

    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.55;
    const stroke: StrokeItem = {
      id: uid('ppt_ink'),
      type: 'stroke',
      tool: isHl ? 'highlighter' : tool === 'pencil' ? 'pencil' : 'pen',
      points: [{ x: pt.x, y: pt.y, pressure, t: Date.now() }],
      color: isHl ? hlColor : resolvedPenColor,
      width: isHl ? hlWidth : penWidth,
      opacity: isHl ? hlOpacity : tool === 'pencil' ? 0.85 : 1,
      lineStyle: isHl ? 'solid' : penStyle,
      highlightMode: isHl ? hlMode : undefined,
    };

    interactionRef.current = {
      type: 'draw',
      stroke,
      lastRawX: pt.x,
      lastRawY: pt.y,
      lastPressure: pressure,
    };
    if (selectedIds.length > 0) onSelectedIdsChange([]);
    drawOverlay();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toLogicalPoint(e.clientX, e.clientY);
    cursorPtRef.current = pt;

    const mode = interactionRef.current;

    // Hover preview for OSNAP & Eraser when not actively dragging
    if (mode.type === 'none') {
      if (tool === 'shape' && (osnap.enabled || osnap.oneShot)) {
        const snap = findBestOsnap(
          visibleSnappableElements(),
          pt,
          null,
          osnap,
          10 / scale,
          { drawingShapeType: activeShape }
        );
        osnapCandidateRef.current = snap;
        drawOverlay();
      } else {
        if (osnapCandidateRef.current) osnapCandidateRef.current = null;
        if (tool === 'eraser') drawOverlay();
      }
      return;
    }

    if (activePointerIdRef.current !== e.pointerId) return;

    if (tool === 'laser') {
      laserPointsRef.current.push({ x: pt.x, y: pt.y, t: performance.now() });
      startLaserLoop();
      return;
    }

    if (mode.type === 'eraseStroke') {
      const next = mode.items.filter(
        (el) => (hideLockedImages && el.type === 'image' && el.locked) || !hitTestElement(el, pt, eraserSize / 2)
      );
      if (next.length !== mode.items.length) {
        mode.items = next;
        mode.dirty = true;
        drawBase();
      }
      drawOverlay();
      return;
    }

    if (mode.type === 'erasePartial') {
      const next: BoardElement[] = [];
      for (const el of mode.items) {
        if (el.type === 'stroke') {
          next.push(...eraseStrokePartial(el, pt, eraserSize / 2));
        } else {
          next.push(el);
        }
      }
      mode.items = next;
      mode.dirty = true;
      drawBase();
      drawOverlay();
      return;
    }

    if (mode.type === 'lasso') {
      const last = mode.points[mode.points.length - 1];
      if (!last || dist(last, pt) >= 3) {
        mode.points.push(pt);
        drawOverlay();
      }
      return;
    }

    if (mode.type === 'boxSelect') {
      mode.x1 = pt.x;
      mode.y1 = pt.y;
      drawOverlay();
      return;
    }

    if (mode.type === 'moveSelected') {
      const dx = pt.x - mode.startX;
      const dy = pt.y - mode.startY;
      mode.previewElements = mode.origElements.map((el) =>
        selectedIds.includes(el.id) ? translateElement(el, dx, dy) : el
      );
      drawBase();
      drawOverlay();
      return;
    }

    if (mode.type === 'resizeSelected') {
      const newW = Math.max(24, pt.x - mode.origBox.x);
      const newH = Math.max(24, pt.y - mode.origBox.y);
      const newBox = { ...mode.origBox, width: newW, height: newH };
      mode.previewElements = mode.origElements.map((el) =>
        selectedIds.includes(el.id) ? scaleElementInBox(el, mode.origBox, newBox) : el
      );
      drawBase();
      drawOverlay();
      return;
    }

    if (mode.type === 'shape') {
      const isLinear = isLinearShapeType(mode.shape.shapeType);
      const baseStartX = mode.deferredAnchor ? mode.deferredAnchor.x : mode.startX;
      const baseStartY = mode.deferredAnchor ? mode.deferredAnchor.y : mode.startY;
      const snap = findBestOsnap(
        visibleSnappableElements(),
        pt,
        { x: baseStartX, y: baseStartY },
        osnap,
        10 / scale,
        { drawingShapeType: mode.shape.shapeType }
      );

      let activeStartX = baseStartX;
      let activeStartY = baseStartY;
      let endPt = { x: pt.x, y: pt.y };

      if (snap) {
        if (
          isLinear &&
          mode.deferredEllipse &&
          mode.deferredAnchor &&
          snap.type === 'tangent' &&
          snap.deferredEllipse
        ) {
          const common = solveCommonTangent(
            mode.deferredEllipse,
            mode.deferredAnchor,
            snap.deferredEllipse,
            snap
          );
          if (common) {
            activeStartX = common.p1.x;
            activeStartY = common.p1.y;
            endPt = common.p2;
            osnapCandidateRef.current = { ...snap, x: common.p2.x, y: common.p2.y };
          } else {
            endPt = { x: snap.x, y: snap.y };
            osnapCandidateRef.current = snap;
          }
        } else {
          endPt = { x: snap.x, y: snap.y };
          if (isLinear && mode.deferredEllipse && mode.deferredAnchor) {
            const tangentStart = resolveDeferredTangentStart(
              mode.deferredEllipse,
              endPt,
              mode.deferredAnchor
            );
            if (tangentStart) {
              activeStartX = tangentStart.x;
              activeStartY = tangentStart.y;
            }
          }
          osnapCandidateRef.current = snap;
        }
        shiftAngleLineRef.current = false;
      } else {
        osnapCandidateRef.current = null;
        if (e.shiftKey) {
          if (isLinear) {
            const rawW = pt.x - baseStartX;
            const rawH = pt.y - baseStartY;
            const len = Math.hypot(rawW, rawH);
            if (len > 1) {
              const rawAngle = Math.atan2(rawH, rawW);
              const step = Math.PI / 4; // 8 CAD directions: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
              const snappedAngle = Math.round(rawAngle / step) * step;
              let sw = Math.cos(snappedAngle) * len;
              let sh = Math.sin(snappedAngle) * len;
              if (Math.abs(sw) < 1e-6) sw = 0;
              if (Math.abs(sh) < 1e-6) sh = 0;
              endPt = { x: baseStartX + sw, y: baseStartY + sh };
            }
            shiftAngleLineRef.current = true;
          } else {
            const rawW = pt.x - baseStartX;
            const rawH = pt.y - baseStartY;
            const s = Math.max(Math.abs(rawW), Math.abs(rawH));
            endPt = {
              x: baseStartX + (rawW < 0 ? -s : s),
              y: baseStartY + (rawH < 0 ? -s : s),
            };
            shiftAngleLineRef.current = false;
          }
        } else {
          shiftAngleLineRef.current = false;
        }
      }

      mode.shape = {
        ...mode.shape,
        x: activeStartX,
        y: activeStartY,
        width: endPt.x - activeStartX,
        height: endPt.y - activeStartY,
      };
      drawOverlay();
      return;
    }

    if (mode.type === 'draw') {
      const nativeEv = e.nativeEvent as PointerEvent;
      const coalesced =
        typeof nativeEv.getCoalescedEvents === 'function' ? nativeEv.getCoalescedEvents() : [];
      const evList = coalesced.length > 0 ? coalesced : [nativeEv];

      let changed = false;
      for (const ce of evList) {
        if (ce.pointerType === 'pen' && (ce.buttons & 1) === 0) continue;
        let cp = toLogicalPoint(ce.clientX, ce.clientY);
        if (mode.stroke.tool === 'highlighter' && mode.stroke.highlightMode === 'block') {
          const p0 = mode.stroke.points[0];
          mode.stroke.points = [p0, { x: cp.x, y: cp.y, pressure: 0.5, t: Date.now() }];
          changed = true;
          continue;
        }
        if (mode.stroke.tool === 'highlighter' && hlStraight) {
          cp = { x: cp.x, y: mode.stroke.points[0].y };
        }

        const minStep = stylusSettings.minMovePx || 1.5;
        if (Math.hypot(cp.x - mode.lastRawX, cp.y - mode.lastRawY) < minStep) continue;
        const p =
          ce.pointerType === 'pen' && ce.pressure > 0
            ? mode.lastPressure * 0.5 + ce.pressure * 0.5
            : 0.55;
        const lastPt = mode.stroke.points[mode.stroke.points.length - 1];
        const sx = lastPt ? lastPt.x * 0.32 + cp.x * 0.68 : cp.x;
        const sy = lastPt ? lastPt.y * 0.32 + cp.y * 0.68 : cp.y;
        mode.stroke.points.push({ x: sx, y: sy, pressure: p, t: Date.now() });
        mode.lastRawX = cp.x;
        mode.lastRawY = cp.y;
        mode.lastPressure = p;
        changed = true;
      }

      if (changed) drawOverlay();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;

    const mode = interactionRef.current;
    interactionRef.current = { type: 'none' };

    if (mode.type === 'draw') {
      if (mode.stroke.points.length === 1) {
        const p0: Point = mode.stroke.points[0];
        mode.stroke.points.push({ ...p0, x: p0.x + 0.5, y: p0.y + 0.5 });
      }
      let added: BoardElement = mode.stroke;
      if (
        inkToShape &&
        (mode.stroke.tool === 'pen' || mode.stroke.tool === 'pencil')
      ) {
        const recognized = recognizeInkShape(mode.stroke);
        if (recognized) added = recognized;
      }
      drawOverlay();
      onCommitElements([...elements, added]);
      return;
    }

    if (mode.type === 'shape') {
      osnapCandidateRef.current = null;
      shiftAngleLineRef.current = false;
      drawOverlay();
      if (osnap.oneShot) {
        onOsnapChange((prev) => ({ ...prev, oneShot: null }));
      }
      if (Math.hypot(mode.shape.width, mode.shape.height) >= 8) {
        onCommitElements([...elements, mode.shape]);
      }
      return;
    }

    if (mode.type === 'eraseStroke' || mode.type === 'erasePartial') {
      if (mode.dirty) {
        onCommitElements(mode.items);
      } else {
        drawBase();
      }
      drawOverlay();
      return;
    }

    if (mode.type === 'lasso') {
      const poly = mode.points;
      if (poly.length >= 3) {
        const matched = elements
          .filter((el) => {
            if (hideLockedImages && el.type === 'image' && el.locked) return false;
            if (el.type === 'stroke') {
              return el.points.some((p) => pointInPolygon(p, poly));
            }
            const b = getElementBBox(el);
            return pointInPolygon({ x: b.x + b.width / 2, y: b.y + b.height / 2 }, poly);
          })
          .map((el) => el.id);
        onSelectedIdsChange(matched);
      }
      drawOverlay();
      return;
    }

    if (mode.type === 'boxSelect') {
      const box = {
        x: Math.min(mode.x0, mode.x1),
        y: Math.min(mode.y0, mode.y1),
        width: Math.abs(mode.x1 - mode.x0),
        height: Math.abs(mode.y1 - mode.y0),
      };
      if (box.width >= 4 || box.height >= 4) {
        const matched = elements
          .filter((el) => !(hideLockedImages && el.type === 'image' && el.locked) && bboxesIntersect(getElementBBox(el), box))
          .map((el) => el.id);
        onSelectedIdsChange(matched);
      }
      drawOverlay();
      return;
    }

    if (mode.type === 'moveSelected' || mode.type === 'resizeSelected') {
      onCommitElements(mode.previewElements);
      drawOverlay();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = toLogicalPoint(e.clientX, e.clientY);
    const hit = [...elements]
      .reverse()
      .find((el): el is TextItem => el.type === 'text' && hitTestElement(el, pt, 10 / scale));
    if (hit) {
      onActivateTarget?.();
      setEditingText({
        elementId: hit.id,
        draft: hit.text,
        x: hit.x,
        y: hit.y,
        width: hit.width,
        height: hit.height,
        fontSize: hit.fontSize,
        color: hit.color,
      });
    }
  };

  let cursorClass = 'cursor-crosshair';
  let customCursorStyle: React.CSSProperties | undefined;
  if (tool === 'pointer') {
    cursorClass = 'cursor-pointer';
  } else if (tool === 'select') {
    cursorClass = 'cursor-default';
  } else if (tool === 'text') {
    cursorClass = 'cursor-text';
  } else if (tool === 'eraser') {
    cursorClass = 'cursor-none';
  } else if (tool === 'pen' || tool === 'pencil' || tool === 'highlighter') {
    cursorClass = '';
    customCursorStyle = { cursor: PEN_SVG_CURSOR };
  }

  return (
    <div
      style={{ width: renderedWidth, height: renderedHeight }}
      className="relative select-none"
    >
      <canvas
        ref={baseCanvasRef}
        style={{ width: renderedWidth, height: renderedHeight }}
        className="absolute inset-0 block pointer-events-none"
      />
      <canvas
        ref={overlayCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          cursorPtRef.current = null;
          osnapCandidateRef.current = null;
          drawOverlay();
        }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          if (e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            const menuW = 264;
            const menuH = 400;
            setOsnapMenu({
              x: Math.min(window.innerWidth - menuW - 8, Math.max(8, e.clientX)),
              y: Math.min(window.innerHeight - menuH - 8, Math.max(8, e.clientY)),
            });
          }
        }}
        style={{ width: renderedWidth, height: renderedHeight, ...customCursorStyle }}
        className={`absolute inset-0 block touch-none-canvas ${cursorClass}`}
      />

      {/* Inline Text Editor */}
      {editingText && (
        <div
          style={{
            left: editingText.x * scale,
            top: editingText.y * scale,
            minWidth: Math.max(180, editingText.width * scale),
          }}
          className="absolute z-20"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <textarea
            autoFocus
            value={editingText.draft}
            onChange={(e) =>
              setEditingText((prev) => (prev ? { ...prev, draft: e.target.value } : null))
            }
            onBlur={commitInlineText}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                setEditingText(null);
              } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                commitInlineText();
              }
            }}
            placeholder="Nhập nội dung chữ..."
            style={{
              fontSize: Math.max(13, editingText.fontSize * scale),
              color: editingText.color,
            }}
            className="w-full min-h-[56px] px-2 py-1 rounded-lg bg-slate-950/55 backdrop-blur-xs border-2 border-blue-500 outline-none resize font-medium leading-snug shadow-xl placeholder:text-slate-400"
          />
        </div>
      )}

      {/* CAD OSNAP Context Menu (Shift + Right-Click) */}
      {osnapMenu && (
        <div
          ref={osnapMenuRef}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ left: osnapMenu.x, top: osnapMenu.y }}
          className="fixed z-60 w-66 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-white/15 shadow-2xl p-2.5 select-none space-y-2 text-white"
        >
          <div className="flex items-center justify-between px-1">
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
              title="Bật/Tắt nhanh bằng phím F3"
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer ${
                osnap.enabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {osnap.enabled ? 'ĐANG BẬT (F3)' : 'ĐÃ TẮT (F3)'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 px-0.5">
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
                onOsnapChange((prev) => ({
                  ...prev,
                  enabled: false,
                  oneShot: null,
                }))
              }
              className="py-1 rounded-lg bg-white/10 hover:bg-rose-500/30 text-[10px] font-medium text-slate-300 hover:text-rose-300 cursor-pointer"
            >
              Tắt hết
            </button>
          </div>

          <div className="space-y-0.5 max-h-60 overflow-y-auto">
            {OSNAP_META.map((item) => {
              const checked = osnap.enabled && osnap.modes[item.type];
              const isOneShot = osnap.oneShot === item.type;
              return (
                <div
                  key={item.type}
                  className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg transition-colors ${
                    isOneShot
                      ? 'bg-emerald-950/70 border border-emerald-500/60'
                      : 'hover:bg-white/10'
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
                    <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" aria-hidden="true">
                      {item.type === 'endpoint' && (
                        <rect x="3" y="3" width="10" height="10" fill="none" stroke={item.color} strokeWidth="1.8" />
                      )}
                      {item.type === 'intersection' && (
                        <path d="M3 3 L13 13 M13 3 L3 13" fill="none" stroke={item.color} strokeWidth="1.8" strokeLinecap="round" />
                      )}
                      {item.type === 'midpoint' && (
                        <polygon points="8,2.5 13.5,13 2.5,13" fill="none" stroke={item.color} strokeWidth="1.8" strokeLinejoin="round" />
                      )}
                      {item.type === 'center' && (
                        <>
                          <circle cx="8" cy="8" r="5" fill="none" stroke={item.color} strokeWidth="1.6" />
                          <path d="M1.5 8 H14.5 M8 1.5 V14.5" stroke={item.color} strokeWidth="1.2" />
                        </>
                      )}
                      {item.type === 'quadrant' && (
                        <polygon points="8,2 14,8 8,14 2,8" fill="none" stroke={item.color} strokeWidth="1.8" strokeLinejoin="round" />
                      )}
                      {item.type === 'tangent' && (
                        <>
                          <circle cx="8" cy="9" r="4.5" fill="none" stroke={item.color} strokeWidth="1.7" />
                          <line x1="2.5" y1="3" x2="13.5" y2="3" stroke={item.color} strokeWidth="1.8" strokeLinecap="round" />
                        </>
                      )}
                      {item.type === 'perpendicular' && (
                        <path d="M2.5 13 H13.5 M8 13 V3 M8 8.5 H12 V13" fill="none" stroke={item.color} strokeWidth="1.7" strokeLinecap="round" />
                      )}
                      {item.type === 'nearest' && (
                        <polygon points="3,3 13,3 3,13 13,13" fill="none" stroke={item.color} strokeWidth="1.6" strokeLinejoin="round" />
                      )}
                    </svg>
                    <span className="text-[11px] font-medium text-slate-100">{item.label}</span>
                    {checked && <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (item.type === 'tangent' && !isLinearShapeType(activeShape)) {
                        onSelectShapeTool?.('line');
                      }
                      onOsnapChange((prev) => ({
                        ...prev,
                        enabled: true,
                        oneShot: item.type as SnapType,
                      }));
                      setOsnapMenu(null);
                    }}
                    title="Chỉ bắt điểm này cho nét vẽ tiếp theo"
                    className="px-1.5 py-0.5 rounded bg-white/15 hover:bg-blue-600 text-[9px] font-semibold text-slate-200 hover:text-white cursor-pointer shrink-0"
                  >
                    Chỉ bắt
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

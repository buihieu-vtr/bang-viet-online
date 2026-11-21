import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  RotateCw,
  Trash2,
} from 'lucide-react';
import {
  BBox,
  BoardElement,
  BoardPage,
  EraserMode,
  ImageItem,
  PenSlot,
  Point,
  RulerState,
  SelectMode,
  ShapeItem,
  ShapeType,
  StickyItem,
  StrokeItem,
  TextItem,
  ToolType,
  ViewportState,
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
  rotateElementAround,
  scaleElementInBox,
  snapPointToRuler,
  translateElement,
  uid,
} from '../utils/geometry';
import {
  isDarkBoardTemplate,
  LaserPoint,
  renderElement,
  renderLaserTrail,
  renderPaperBackground,
  renderShape,
  renderStroke,
} from '../utils/renderer';

interface WhiteboardCanvasProps {
  page: BoardPage;
  viewport: ViewportState;
  onViewportChange: React.Dispatch<React.SetStateAction<ViewportState>>;
  activeTool: ToolType;
  activePenSlot: PenSlot;
  selectMode: SelectMode;
  eraserMode: EraserMode;
  eraserSize: number;
  activeShape: ShapeType;
  shapeStrokeColor: string;
  shapeFillColor: string;
  shapeDashed: boolean;
  inkToShape: boolean;
  stylusOnly: boolean;
  darkMode: boolean;
  ruler: RulerState;
  onRulerChange: React.Dispatch<React.SetStateAction<RulerState>>;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onCommitElements: (nextElements: BoardElement[]) => void;
  onSelectTool: (tool: ToolType) => void;
}

type InteractionMode =
  | { type: 'none' }
  | { type: 'pan'; startScreenX: number; startScreenY: number; origOffsetX: number; origOffsetY: number }
  | { type: 'draw'; stroke: StrokeItem; rulerSnapped: boolean }
  | { type: 'shape'; shape: ShapeItem; startX: number; startY: number }
  | { type: 'eraseStroke' }
  | { type: 'erasePartial' }
  | { type: 'lasso'; points: { x: number; y: number }[] }
  | { type: 'boxSelect'; startX: number; startY: number; curX: number; curY: number }
  | { type: 'moveSelected'; lastX: number; lastY: number; snapshot: BoardElement[] }
  | {
      type: 'resizeSelected';
      handle: 'nw' | 'ne' | 'sw' | 'se';
      origBox: BBox;
      snapshot: BoardElement[];
    }
  | {
      type: 'rotateSelected';
      center: { x: number; y: number };
      startAngle: number;
      lastDelta: number;
      snapshot: BoardElement[];
    };

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  page,
  viewport,
  onViewportChange,
  activeTool,
  activePenSlot,
  selectMode,
  eraserMode,
  eraserSize,
  activeShape,
  shapeStrokeColor,
  shapeFillColor,
  shapeDashed,
  inkToShape,
  stylusOnly,
  darkMode,
  ruler,
  onRulerChange,
  selectedIds,
  onSelectedIdsChange,
  onCommitElements,
  onSelectTool,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const laserPointsRef = useRef<LaserPoint[]>([]);
  const interactionRef = useRef<InteractionMode>({ type: 'none' });
  const [liveElements, setLiveElements] = useState<BoardElement[] | null>(null);
  const [liveDrawStroke, setLiveDrawStroke] = useState<StrokeItem | null>(null);
  const [liveShape, setLiveShape] = useState<ShapeItem | null>(null);
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[] | null>(null);
  const [boxSelectRect, setBoxSelectRect] = useState<BBox | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const [renderTick, setRenderTick] = useState(0);

  // Ruler dragging state
  const rulerDragRef = useRef<
    | null
    | { mode: 'move'; startX: number; startY: number; origX: number; origY: number }
    | { mode: 'rotate'; origAngle: number; startPointerAngle: number }
  >(null);

  const displayedElements = liveElements ?? page.elements;

  const selectedElements = useMemo(
    () => displayedElements.filter((el) => selectedIds.includes(el.id)),
    [displayedElements, selectedIds]
  );

  const selectionBBox = useMemo(
    () => getCombinedBBox(selectedElements),
    [selectedElements]
  );

  // Screen <-> World conversion
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return {
        x: (sx - viewport.offsetX) / viewport.zoom,
        y: (sy - viewport.offsetY) / viewport.zoom,
      };
    },
    [viewport]
  );

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ width, height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Spacebar pan & Delete key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePressed(true);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        const next = page.elements.filter((el) => !selectedIds.includes(el.id));
        onCommitElements(next);
        onSelectedIdsChange([]);
      }
      if (e.key === 'Escape') {
        onSelectedIdsChange([]);
        setEditingTextId(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [page.elements, selectedIds, onCommitElements, onSelectedIdsChange]);

  // Main high-DPI Canvas render pass
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(canvasSize.width * dpr);
    const targetH = Math.round(canvasSize.height * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    renderPaperBackground(
      ctx,
      page,
      viewport,
      canvasSize.width,
      canvasSize.height,
      darkMode
    );

    ctx.save();
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.zoom, viewport.zoom);

    for (const el of displayedElements) {
      if (editingTextId === el.id) continue; // Rendered by inline editor
      renderElement(ctx, el, imageCacheRef.current, () => {
        setRenderTick((t) => t + 1);
      });
    }

    if (liveDrawStroke) {
      renderStroke(ctx, liveDrawStroke);
    }
    if (liveShape) {
      renderShape(ctx, liveShape);
    }

    // Lasso overlay
    if (lassoPoints && lassoPoints.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#2563EB';
      ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
      ctx.lineWidth = 1.5 / viewport.zoom;
      ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
      for (let i = 1; i < lassoPoints.length; i++) {
        ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Box select overlay
    if (boxSelectRect) {
      ctx.save();
      ctx.strokeStyle = '#2563EB';
      ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
      ctx.lineWidth = 1.5 / viewport.zoom;
      ctx.strokeRect(
        boxSelectRect.x,
        boxSelectRect.y,
        boxSelectRect.width,
        boxSelectRect.height
      );
      ctx.fillRect(
        boxSelectRect.x,
        boxSelectRect.y,
        boxSelectRect.width,
        boxSelectRect.height
      );
      ctx.restore();
    }

    // Eraser cursor ring
    if (activeTool === 'eraser' && cursorWorld) {
      ctx.save();
      ctx.strokeStyle = eraserMode === 'stroke' ? '#EF4444' : '#3B82F6';
      ctx.fillStyle =
        eraserMode === 'stroke'
          ? 'rgba(239, 68, 68, 0.08)'
          : 'rgba(59, 130, 246, 0.08)';
      ctx.lineWidth = 1.5 / viewport.zoom;
      const r = eraserMode === 'stroke' ? 12 / viewport.zoom : eraserSize / 2;
      ctx.beginPath();
      ctx.arc(cursorWorld.x, cursorWorld.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Laser pointer trail
    if (laserPointsRef.current.length > 0) {
      renderLaserTrail(ctx, laserPointsRef.current, performance.now());
    }

    ctx.restore();
    ctx.restore();
  }, [
    page,
    viewport,
    canvasSize,
    darkMode,
    displayedElements,
    liveDrawStroke,
    liveShape,
    lassoPoints,
    boxSelectRect,
    activeTool,
    eraserMode,
    eraserSize,
    cursorWorld,
    editingTextId,
    renderTick,
  ]);

  // Laser animation ticker
  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      const now = performance.now();
      const active = laserPointsRef.current.filter((p) => now - p.t < 1150);
      if (active.length !== laserPointsRef.current.length) {
        laserPointsRef.current = active;
      }
      if (active.length > 0) {
        setRenderTick((t) => (t + 1) % 100000);
        rafId = requestAnimationFrame(tick);
      }
    };
    if (laserPointsRef.current.length > 0) {
      rafId = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(rafId);
  });

  // Wheel zoom / pan
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
      const factor = e.deltaY < 0 ? 1.09 : 0.91;
      onViewportChange((prev) => {
        const nextZoom = Math.min(4, Math.max(0.2, prev.zoom * factor));
        const worldX = (sx - prev.offsetX) / prev.zoom;
        const worldY = (sy - prev.offsetY) / prev.zoom;
        return {
          zoom: nextZoom,
          offsetX: sx - worldX * nextZoom,
          offsetY: sy - worldY * nextZoom,
        };
      });
    }
  };

  const commitInlineText = () => {
    if (!editingTextId) return;
    const target = page.elements.find((e) => e.id === editingTextId);
    if (target && (target.type === 'text' || target.type === 'sticky')) {
      const trimmed = editingDraft.trim();
      if (target.type === 'text' && !trimmed) {
        onCommitElements(page.elements.filter((e) => e.id !== editingTextId));
      } else {
        onCommitElements(
          page.elements.map((e) =>
            e.id === editingTextId ? { ...e, text: editingDraft } : e
          )
        );
      }
    }
    setEditingTextId(null);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // If editing text, commit it first
    if (editingTextId) {
      commitInlineText();
    }

    // Palm Rejection: if Stylus-Only is enabled and pointer is finger touch, allow panning instead of drawing
    const isPalmTouch = stylusOnly && e.pointerType === 'touch';

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.setPointerCapture(e.pointerId);
    }

    const pt = screenToWorld(e.clientX, e.clientY);
    setCursorWorld(pt);

    // Middle mouse, Spacebar, Pan tool, or finger in Stylus-Only mode => Pan
    if (e.button === 1 || spacePressed || activeTool === 'pan' || isPalmTouch) {
      interactionRef.current = {
        type: 'pan',
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        origOffsetX: viewport.offsetX,
        origOffsetY: viewport.offsetY,
      };
      return;
    }

    if (e.button !== 0) return;

    // Laser Pointer
    if (activeTool === 'laser') {
      laserPointsRef.current.push({ x: pt.x, y: pt.y, t: performance.now() });
      setRenderTick((t) => t + 1);
      return;
    }

    // Pen / Pencil / Highlighter
    if (activeTool === 'pen' || activeTool === 'pencil' || activeTool === 'highlighter') {
      const snap = snapPointToRuler(pt.x, pt.y, ruler);
      const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
      const stroke: StrokeItem = {
        id: uid('stroke'),
        type: 'stroke',
        tool: activeTool,
        color: activePenSlot.color,
        width: activePenSlot.width,
        opacity: activePenSlot.opacity,
        points: [{ x: snap.x, y: snap.y, pressure, t: Date.now() }],
      };
      interactionRef.current = { type: 'draw', stroke, rulerSnapped: snap.snapped };
      setLiveDrawStroke(stroke);
      onSelectedIdsChange([]);
      return;
    }

    // Eraser
    if (activeTool === 'eraser') {
      onSelectedIdsChange([]);
      if (eraserMode === 'stroke') {
        interactionRef.current = { type: 'eraseStroke' };
        const filtered = page.elements.filter((el) => !hitTestElement(el, pt, 10));
        if (filtered.length !== page.elements.length) {
          setLiveElements(filtered);
        } else {
          setLiveElements([...page.elements]);
        }
      } else {
        interactionRef.current = { type: 'erasePartial' };
        const next: BoardElement[] = [];
        for (const el of page.elements) {
          if (el.type === 'stroke') {
            next.push(...eraseStrokePartial(el, pt, eraserSize / 2));
          } else {
            next.push(el);
          }
        }
        setLiveElements(next);
      }
      return;
    }

    // Shapes
    if (activeTool === 'shape') {
      const shape: ShapeItem = {
        id: uid('shape'),
        type: 'shape',
        shapeType: activeShape,
        x: pt.x,
        y: pt.y,
        width: 1,
        height: 1,
        rotation: 0,
        strokeColor: shapeStrokeColor,
        fillColor: shapeFillColor,
        fillOpacity: shapeFillColor === 'transparent' ? 0 : 0.25,
        strokeWidth: 3,
        dashed: shapeDashed,
        rows: 3,
        cols: 3,
      };
      interactionRef.current = { type: 'shape', shape, startX: pt.x, startY: pt.y };
      setLiveShape(shape);
      onSelectedIdsChange([]);
      return;
    }

    // Text tool
    if (activeTool === 'text') {
      // Check if clicked on existing text/sticky to edit
      const hitText = [...page.elements]
        .reverse()
        .find((el) => (el.type === 'text' || el.type === 'sticky') && hitTestElement(el, pt, 4));
      if (hitText && (hitText.type === 'text' || hitText.type === 'sticky')) {
        setEditingTextId(hitText.id);
        setEditingDraft(hitText.text);
        return;
      }

      const isDarkPaper = isDarkBoardTemplate(page.template);
      const newText: TextItem = {
        id: uid('text'),
        type: 'text',
        x: pt.x,
        y: pt.y,
        width: 260,
        height: 80,
        rotation: 0,
        text: '',
        fontSize: 20,
        fontFamily: '"DM Sans", sans-serif',
        color: isDarkPaper ? '#F8FAFC' : '#0F172A',
        bold: false,
        italic: false,
        align: 'left',
        bgColor: 'transparent',
      };
      onCommitElements([...page.elements, newText]);
      setEditingTextId(newText.id);
      setEditingDraft('');
      onSelectTool('select');
      onSelectedIdsChange([newText.id]);
      return;
    }

    // Select tool
    if (activeTool === 'select') {
      // Check if clicking inside current selection bounding box
      if (selectionBBox && selectedIds.length > 0) {
        if (
          pt.x >= selectionBBox.x &&
          pt.x <= selectionBBox.x + selectionBBox.width &&
          pt.y >= selectionBBox.y &&
          pt.y <= selectionBBox.y + selectionBBox.height
        ) {
          interactionRef.current = {
            type: 'moveSelected',
            lastX: pt.x,
            lastY: pt.y,
            snapshot: page.elements,
          };
          setLiveElements(page.elements);
          return;
        }
      }

      // Check direct hit on top-most element
      const hit = [...page.elements]
        .reverse()
        .find((el) => hitTestElement(el, pt, 8 / viewport.zoom));

      if (hit) {
        if (e.shiftKey) {
          const exists = selectedIds.includes(hit.id);
          onSelectedIdsChange(
            exists ? selectedIds.filter((id) => id !== hit.id) : [...selectedIds, hit.id]
          );
        } else {
          onSelectedIdsChange([hit.id]);
        }
        interactionRef.current = {
          type: 'moveSelected',
          lastX: pt.x,
          lastY: pt.y,
          snapshot: page.elements,
        };
        setLiveElements(page.elements);
        return;
      }

      // Otherwise start Lasso or Box select
      onSelectedIdsChange([]);
      if (selectMode === 'lasso') {
        interactionRef.current = { type: 'lasso', points: [pt] };
        setLassoPoints([pt]);
      } else {
        interactionRef.current = {
          type: 'boxSelect',
          startX: pt.x,
          startY: pt.y,
          curX: pt.x,
          curY: pt.y,
        };
        setBoxSelectRect({ x: pt.x, y: pt.y, width: 0, height: 0 });
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = screenToWorld(e.clientX, e.clientY);
    setCursorWorld(pt);

    if (activeTool === 'laser' && e.buttons > 0) {
      laserPointsRef.current.push({ x: pt.x, y: pt.y, t: performance.now() });
      setRenderTick((t) => t + 1);
      return;
    }

    const mode = interactionRef.current;
    if (mode.type === 'none') return;

    if (mode.type === 'pan') {
      const dx = e.clientX - mode.startScreenX;
      const dy = e.clientY - mode.startScreenY;
      onViewportChange((prev) => ({
        ...prev,
        offsetX: mode.origOffsetX + dx,
        offsetY: mode.origOffsetY + dy,
      }));
      return;
    }

    if (mode.type === 'draw') {
      const snap = snapPointToRuler(pt.x, pt.y, ruler);
      const nextPt: Point = {
        x: snap.x,
        y: snap.y,
        pressure: e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5,
        t: Date.now(),
      };
      const pts = mode.stroke.points;
      const last = pts[pts.length - 1];
      if (!last || dist(last, nextPt) >= 1.5) {
        const updated: StrokeItem = {
          ...mode.stroke,
          points: [...pts, nextPt],
        };
        mode.stroke = updated;
        setLiveDrawStroke(updated);
      }
      return;
    }

    if (mode.type === 'shape') {
      let w = pt.x - mode.startX;
      let h = pt.y - mode.startY;
      if (e.shiftKey) {
        const s = Math.max(Math.abs(w), Math.abs(h));
        w = w < 0 ? -s : s;
        h = h < 0 ? -s : s;
      }
      const updated: ShapeItem = {
        ...mode.shape,
        width: w,
        height: h,
      };
      mode.shape = updated;
      setLiveShape(updated);
      return;
    }

    if (mode.type === 'eraseStroke') {
      setLiveElements((prev) =>
        (prev ?? page.elements).filter((el) => !hitTestElement(el, pt, 10))
      );
      return;
    }

    if (mode.type === 'erasePartial') {
      setLiveElements((prev) => {
        const source = prev ?? page.elements;
        const next: BoardElement[] = [];
        for (const el of source) {
          if (el.type === 'stroke') {
            next.push(...eraseStrokePartial(el, pt, eraserSize / 2));
          } else {
            next.push(el);
          }
        }
        return next;
      });
      return;
    }

    if (mode.type === 'lasso') {
      const last = mode.points[mode.points.length - 1];
      if (!last || dist(last, pt) >= 5) {
        mode.points.push(pt);
        setLassoPoints([...mode.points]);
      }
      return;
    }

    if (mode.type === 'boxSelect') {
      mode.curX = pt.x;
      mode.curY = pt.y;
      const x = Math.min(mode.startX, pt.x);
      const y = Math.min(mode.startY, pt.y);
      const width = Math.abs(pt.x - mode.startX);
      const height = Math.abs(pt.y - mode.startY);
      setBoxSelectRect({ x, y, width, height });
      return;
    }

    if (mode.type === 'moveSelected') {
      const dx = pt.x - mode.lastX;
      const dy = pt.y - mode.lastY;
      mode.lastX = pt.x;
      mode.lastY = pt.y;
      setLiveElements((prev) =>
        (prev ?? page.elements).map((el) =>
          selectedIds.includes(el.id) ? translateElement(el, dx, dy) : el
        )
      );
      return;
    }

    if (mode.type === 'resizeSelected') {
      const { origBox, handle, snapshot } = mode;
      let nx = origBox.x;
      let ny = origBox.y;
      let nw = origBox.width;
      let nh = origBox.height;

      if (handle === 'se') {
        nw = Math.max(16, pt.x - origBox.x);
        nh = Math.max(16, pt.y - origBox.y);
      } else if (handle === 'nw') {
        nw = Math.max(16, origBox.x + origBox.width - pt.x);
        nh = Math.max(16, origBox.y + origBox.height - pt.y);
        nx = origBox.x + origBox.width - nw;
        ny = origBox.y + origBox.height - nh;
      } else if (handle === 'ne') {
        nw = Math.max(16, pt.x - origBox.x);
        nh = Math.max(16, origBox.y + origBox.height - pt.y);
        ny = origBox.y + origBox.height - nh;
      } else if (handle === 'sw') {
        nw = Math.max(16, origBox.x + origBox.width - pt.x);
        nh = Math.max(16, pt.y - origBox.y);
        nx = origBox.x + origBox.width - nw;
      }

      const newBox: BBox = { x: nx, y: ny, width: nw, height: nh };
      setLiveElements(
        snapshot.map((el) =>
          selectedIds.includes(el.id) ? scaleElementInBox(el, origBox, newBox) : el
        )
      );
      return;
    }

    if (mode.type === 'rotateSelected') {
      const curAngle =
        (Math.atan2(pt.y - mode.center.y, pt.x - mode.center.x) * 180) / Math.PI;
      const delta = curAngle - mode.startAngle;
      mode.lastDelta = delta;
      setLiveElements(
        mode.snapshot.map((el) =>
          selectedIds.includes(el.id)
            ? rotateElementAround(el, mode.center, delta)
            : el
        )
      );
    }
  };

  const handlePointerUp = () => {
    const mode = interactionRef.current;
    interactionRef.current = { type: 'none' };

    if (mode.type === 'draw') {
      let added: BoardElement = mode.stroke;
      if (
        inkToShape &&
        !mode.rulerSnapped &&
        (mode.stroke.tool === 'pen' || mode.stroke.tool === 'pencil')
      ) {
        const recognized = recognizeInkShape(mode.stroke);
        if (recognized) {
          added = recognized;
        }
      }
      setLiveDrawStroke(null);
      onCommitElements([...page.elements, added]);
      return;
    }

    if (mode.type === 'shape') {
      setLiveShape(null);
      if (Math.hypot(mode.shape.width, mode.shape.height) >= 8) {
        onCommitElements([...page.elements, mode.shape]);
      }
      return;
    }

    if (mode.type === 'eraseStroke' || mode.type === 'erasePartial') {
      if (liveElements) {
        onCommitElements(liveElements);
      }
      setLiveElements(null);
      return;
    }

    if (mode.type === 'lasso') {
      const poly = mode.points;
      setLassoPoints(null);
      if (poly.length >= 3) {
        const matched = page.elements
          .filter((el) => {
            if (el.type === 'stroke') {
              return el.points.some((p) => pointInPolygon(p, poly));
            }
            const b = getElementBBox(el);
            const cx = b.x + b.width / 2;
            const cy = b.y + b.height / 2;
            return pointInPolygon({ x: cx, y: cy }, poly);
          })
          .map((e) => e.id);
        onSelectedIdsChange(matched);
      }
      return;
    }

    if (mode.type === 'boxSelect') {
      const x = Math.min(mode.startX, mode.curX);
      const y = Math.min(mode.startY, mode.curY);
      const width = Math.abs(mode.curX - mode.startX);
      const height = Math.abs(mode.curY - mode.startY);
      setBoxSelectRect(null);
      if (width > 4 || height > 4) {
        const box = { x, y, width, height };
        const matched = page.elements
          .filter((el) => bboxesIntersect(getElementBBox(el), box))
          .map((e) => e.id);
        onSelectedIdsChange(matched);
      }
      return;
    }

    if (
      mode.type === 'moveSelected' ||
      mode.type === 'resizeSelected' ||
      mode.type === 'rotateSelected'
    ) {
      if (liveElements) {
        onCommitElements(liveElements);
      }
      setLiveElements(null);
    }
  };

  // Double click to edit Text or Sticky note
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = screenToWorld(e.clientX, e.clientY);
    const hit = [...page.elements]
      .reverse()
      .find((el) => (el.type === 'text' || el.type === 'sticky') && hitTestElement(el, pt, 6));
    if (hit && (hit.type === 'text' || hit.type === 'sticky')) {
      setEditingTextId(hit.id);
      setEditingDraft(hit.text);
      onSelectedIdsChange([hit.id]);
    }
  };

  // Paste image from clipboard directly onto board!
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const src = reader.result as string;
            const img = new Image();
            img.onload = () => {
              const maxW = 460;
              const scale = img.width > maxW ? maxW / img.width : 1;
              const w = img.width * scale;
              const h = img.height * scale;
              const centerW = (canvasSize.width / 2 - viewport.offsetX) / viewport.zoom;
              const centerH = (canvasSize.height / 2 - viewport.offsetY) / viewport.zoom;
              const newImg: ImageItem = {
                id: uid('img'),
                type: 'image',
                x: centerW - w / 2,
                y: centerH - h / 2,
                width: w,
                height: h,
                rotation: 0,
                src,
                opacity: 1,
              };
              onCommitElements([...page.elements, newImg]);
              onSelectedIdsChange([newImg.id]);
              onSelectTool('select');
            };
            img.src = src;
          };
          reader.readAsDataURL(file);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [page.elements, canvasSize, viewport, onCommitElements, onSelectedIdsChange, onSelectTool]);

  // Ruler screen transform & interaction
  const rulerScreenX = ruler.x * viewport.zoom + viewport.offsetX;
  const rulerScreenY = ruler.y * viewport.zoom + viewport.offsetY;
  const rulerScreenLen = ruler.length * viewport.zoom;

  const startRulerMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    rulerDragRef.current = {
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      origX: ruler.x,
      origY: ruler.y,
    };
  };

  const startRulerRotate = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = canvasRef.current?.getBoundingClientRect();
    const sx = e.clientX - (rect?.left ?? 0);
    const sy = e.clientY - (rect?.top ?? 0);
    const startAngle =
      (Math.atan2(sy - rulerScreenY, sx - rulerScreenX) * 180) / Math.PI;
    rulerDragRef.current = {
      mode: 'rotate',
      origAngle: ruler.angleDeg,
      startPointerAngle: startAngle,
    };
  };

  const handleRulerPointerMove = (e: React.PointerEvent) => {
    const drag = rulerDragRef.current;
    if (!drag) return;
    e.stopPropagation();
    if (drag.mode === 'move') {
      const dx = (e.clientX - drag.startX) / viewport.zoom;
      const dy = (e.clientY - drag.startY) / viewport.zoom;
      onRulerChange((prev) => ({
        ...prev,
        x: drag.origX + dx,
        y: drag.origY + dy,
      }));
    } else if (drag.mode === 'rotate') {
      const rect = canvasRef.current?.getBoundingClientRect();
      const sx = e.clientX - (rect?.left ?? 0);
      const sy = e.clientY - (rect?.top ?? 0);
      const curAngle =
        (Math.atan2(sy - rulerScreenY, sx - rulerScreenX) * 180) / Math.PI;
      let nextAngle = drag.origAngle + (curAngle - drag.startPointerAngle);
      // Normalize -180..180
      nextAngle = ((nextAngle + 180) % 360) - 180;
      if (nextAngle < -180) nextAngle += 360;
      // Magnetic 15 deg snap unless holding Shift
      if (!e.shiftKey) {
        const nearest15 = Math.round(nextAngle / 15) * 15;
        if (Math.abs(nextAngle - nearest15) < 2.8) {
          nextAngle = nearest15;
        }
      }
      onRulerChange((prev) => ({ ...prev, angleDeg: nextAngle }));
    }
  };

  const endRulerDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    rulerDragRef.current = null;
  };

  // Selection action handlers
  const duplicateSelected = () => {
    const clones = selectedElements.map((el) => ({
      ...translateElement(el, 28, 28),
      id: uid(el.type),
    }));
    onCommitElements([...page.elements, ...clones]);
    onSelectedIdsChange(clones.map((c) => c.id));
  };

  const deleteSelected = () => {
    onCommitElements(page.elements.filter((el) => !selectedIds.includes(el.id)));
    onSelectedIdsChange([]);
  };

  const reorderSelected = (dir: 'front' | 'back') => {
    const selected = page.elements.filter((el) => selectedIds.includes(el.id));
    const others = page.elements.filter((el) => !selectedIds.includes(el.id));
    const next = dir === 'front' ? [...others, ...selected] : [...selected, ...others];
    onCommitElements(next);
  };

  // Inline text element being edited
  const editingEl = editingTextId
    ? page.elements.find((e) => e.id === editingTextId)
    : null;

  // Cursor style
  let cursorClass = 'cursor-crosshair';
  if (spacePressed || activeTool === 'pan') cursorClass = 'cursor-grab active:cursor-grabbing';
  else if (activeTool === 'select') cursorClass = 'cursor-default';
  else if (activeTool === 'text') cursorClass = 'cursor-text';
  else if (activeTool === 'eraser') cursorClass = 'cursor-none';

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className="relative flex-1 w-full h-full overflow-hidden touch-none-canvas"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className={`block w-full h-full touch-none-canvas ${cursorClass}`}
      />

      {/* Interactive Selection Overlay Handles & Floating Action Bar */}
      {activeTool === 'select' && selectionBBox && !editingTextId && (
        <div
          className="pointer-events-none absolute border-[1.5px] border-blue-600"
          style={{
            left: selectionBBox.x * viewport.zoom + viewport.offsetX,
            top: selectionBBox.y * viewport.zoom + viewport.offsetY,
            width: selectionBBox.width * viewport.zoom,
            height: selectionBBox.height * viewport.zoom,
          }}
        >
          {/* Floating quick actions toolbar above selection */}
          <div className="pointer-events-auto absolute -top-11 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-1 rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-lg">
            <button
              type="button"
              onClick={duplicateSelected}
              title="Nhân bản"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => reorderSelected('front')}
              title="Đưa lên trên"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => reorderSelected('back')}
              title="Đưa xuống dưới"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
            <button
              type="button"
              onClick={deleteSelected}
              title="Xóa (Delete)"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rotation Handle */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              const center = {
                x: selectionBBox.x + selectionBBox.width / 2,
                y: selectionBBox.y + selectionBBox.height / 2,
              };
              const pt = screenToWorld(e.clientX, e.clientY);
              const startAngle =
                (Math.atan2(pt.y - center.y, pt.x - center.x) * 180) / Math.PI;
              interactionRef.current = {
                type: 'rotateSelected',
                center,
                startAngle,
                lastDelta: 0,
                snapshot: page.elements,
              };
              setLiveElements(page.elements);
              canvasRef.current?.setPointerCapture(e.pointerId);
            }}
            title="Xoay đối tượng"
            className="pointer-events-auto absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center cursor-grab shadow-xs"
          >
            <RotateCw className="w-2.5 h-2.5 text-blue-600" />
          </div>

          {/* 4 Corner Resize Handles */}
          {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
            const posClass =
              handle === 'nw'
                ? '-top-1.5 -left-1.5 cursor-nwse-resize'
                : handle === 'ne'
                  ? '-top-1.5 -right-1.5 cursor-nesw-resize'
                  : handle === 'sw'
                    ? '-bottom-1.5 -left-1.5 cursor-nesw-resize'
                    : '-bottom-1.5 -right-1.5 cursor-nwse-resize';

            return (
              <div
                key={handle}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  interactionRef.current = {
                    type: 'resizeSelected',
                    handle,
                    origBox: selectionBBox,
                    snapshot: page.elements,
                  };
                  setLiveElements(page.elements);
                  canvasRef.current?.setPointerCapture(e.pointerId);
                }}
                className={`pointer-events-auto absolute w-3 h-3 rounded-xs bg-white border-2 border-blue-600 shadow-xs ${posClass}`}
              />
            );
          })}
        </div>
      )}

      {/* Inline Text / Sticky Note Editor */}
      {editingEl && (editingEl.type === 'text' || editingEl.type === 'sticky') && (
        <textarea
          autoFocus
          value={editingDraft}
          onChange={(e) => setEditingDraft(e.target.value)}
          onBlur={commitInlineText}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              commitInlineText();
            }
          }}
          placeholder="Nhập nội dung..."
          style={{
            left: editingEl.x * viewport.zoom + viewport.offsetX,
            top: editingEl.y * viewport.zoom + viewport.offsetY,
            width: Math.max(160, editingEl.width * viewport.zoom),
            height: Math.max(80, editingEl.height * viewport.zoom),
            fontSize: `${editingEl.fontSize * viewport.zoom}px`,
            color: editingEl.type === 'text' ? editingEl.color : editingEl.textColor,
            backgroundColor:
              editingEl.type === 'sticky'
                ? editingEl.noteColor
                : editingEl.bgColor !== 'transparent'
                  ? editingEl.bgColor
                  : isDarkBoardTemplate(page.template)
                    ? 'rgba(20, 56, 40, 0.92)'
                    : 'rgba(255,255,255,0.9)',
          }}
          className="absolute z-20 p-2.5 rounded-lg border-2 border-blue-600 shadow-lg outline-none resize leading-snug font-sans"
        />
      )}

      {/* Interactive On-Canvas Magnetic Ruler (Signature Scrble Ink Feature) */}
      {ruler.visible && (
        <div
          onPointerDown={startRulerMove}
          onPointerMove={handleRulerPointerMove}
          onPointerUp={endRulerDrag}
          onPointerCancel={endRulerDrag}
          onWheel={(e) => {
            e.stopPropagation();
            const step = e.shiftKey ? 1 : 5;
            onRulerChange((prev) => ({
              ...prev,
              angleDeg: Math.round(prev.angleDeg + (e.deltaY > 0 ? step : -step)),
            }));
          }}
          style={{
            left: rulerScreenX,
            top: rulerScreenY,
            width: Math.max(260, rulerScreenLen),
            height: 68 * viewport.zoom,
            transform: `translate(-50%, -50%) rotate(${ruler.angleDeg}deg)`,
          }}
          className="absolute z-20 rounded-md bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-xs border border-slate-400/70 dark:border-slate-500/70 shadow-lg cursor-move select-none flex items-center justify-center"
        >
          {/* Top & Bottom Ruler Tick Marks */}
          <div className="absolute inset-x-0 top-0 h-3 overflow-hidden flex">
            {Array.from({ length: 60 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 border-l border-slate-600/60 dark:border-slate-300/60"
                style={{ height: i % 5 === 0 ? '11px' : '6px' }}
              />
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-3 overflow-hidden flex items-end">
            {Array.from({ length: 60 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 border-l border-slate-600/60 dark:border-slate-300/60"
                style={{ height: i % 5 === 0 ? '11px' : '6px' }}
              />
            ))}
          </div>

          {/* Center Angle Readout */}
          <div className="px-2.5 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-xs font-mono-tabular font-semibold text-slate-800 dark:text-slate-100 shadow-xs">
            {Math.round(ruler.angleDeg)}°
          </div>

          {/* Right Rotation Handle */}
          <div
            onPointerDown={startRulerRotate}
            title="Kéo để xoay góc thước (giữ Shift để chỉnh từng 1°)"
            className="absolute right-3 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing hover:bg-blue-700"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </div>
        </div>
      )}
    </div>
  );
};

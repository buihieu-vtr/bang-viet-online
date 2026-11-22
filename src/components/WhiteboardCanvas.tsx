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
  PAGE_DIMENSIONS,
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
  drawAluminumBoardFrame,
  drawRealisticBoardSurface,
  drawTemplatePattern,
  getTemplateColors,
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
  pages: BoardPage[];
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
  onCommitPageElements: (pageId: string, nextElements: BoardElement[]) => void;
  onSelectPage: (pageId: string) => void;
  scrollToPageRequest: { pageId: string; seq: number } | null;
  onSelectTool: (tool: ToolType) => void;
}

interface PageLayout {
  page: BoardPage;
  index: number;
  x: number;
  topY: number;
  width: number;
  height: number;
}

const PAGE_GAP = 48;

type InteractionMode =
  | { type: 'none' }
  | { type: 'pan'; startScreenX: number; startScreenY: number; origOffsetX: number; origOffsetY: number }
  | {
      type: 'draw';
      pageId: string;
      offsetX: number;
      offsetY: number;
      stroke: StrokeItem;
      rulerSnapped: boolean;
    }
  | {
      type: 'shape';
      pageId: string;
      offsetX: number;
      offsetY: number;
      shape: ShapeItem;
      startX: number;
      startY: number;
    }
  | { type: 'eraseStroke'; pageId: string; offsetX: number; offsetY: number }
  | { type: 'erasePartial'; pageId: string; offsetX: number; offsetY: number }
  | { type: 'lasso'; pageId: string; offsetX: number; offsetY: number; points: { x: number; y: number }[] }
  | {
      type: 'boxSelect';
      pageId: string;
      offsetX: number;
      offsetY: number;
      startX: number;
      startY: number;
      curX: number;
      curY: number;
    }
  | {
      type: 'moveSelected';
      pageId: string;
      offsetX: number;
      offsetY: number;
      lastX: number;
      lastY: number;
      snapshot: BoardElement[];
    }
  | {
      type: 'resizeSelected';
      pageId: string;
      offsetX: number;
      offsetY: number;
      handle: 'nw' | 'ne' | 'sw' | 'se';
      origBox: BBox;
      snapshot: BoardElement[];
    }
  | {
      type: 'rotateSelected';
      pageId: string;
      offsetX: number;
      offsetY: number;
      center: { x: number; y: number };
      startAngle: number;
      lastDelta: number;
      snapshot: BoardElement[];
    };

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  page,
  pages,
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
  onCommitPageElements,
  onSelectPage,
  scrollToPageRequest,
  onSelectTool,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const laserPointsRef = useRef<LaserPoint[]>([]);
  const interactionRef = useRef<InteractionMode>({ type: 'none' });
  const [liveElements, setLiveElements] = useState<{ pageId: string; items: BoardElement[] } | null>(null);
  const [liveDrawStroke, setLiveDrawStroke] = useState<{ pageId: string; stroke: StrokeItem } | null>(null);
  const [liveShape, setLiveShape] = useState<{ pageId: string; shape: ShapeItem } | null>(null);
  const [lassoPoints, setLassoPoints] = useState<{ offsetX: number; offsetY: number; points: { x: number; y: number }[] } | null>(null);
  const [boxSelectRect, setBoxSelectRect] = useState<{ offsetX: number; offsetY: number; box: BBox } | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null);
  const [editingText, setEditingText] = useState<{ pageId: string; elementId: string } | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const [renderTick, setRenderTick] = useState(0);

  const rulerDragRef = useRef<
    | null
    | { mode: 'move'; startX: number; startY: number; origX: number; origY: number }
    | { mode: 'rotate'; origAngle: number; startPointerAngle: number }
  >(null);

  const scrollbarDragRef = useRef<{ startY: number; origOffsetY: number } | null>(null);
  const wasPagedRef = useRef<boolean>(false);
  const lastHandledScrollSeqRef = useRef<number>(0);
  const activeTouchPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{ lastDist: number; lastMidX: number; lastMidY: number } | null>(null);

  const isPagedMode = page.pageSize !== 'infinite';

  // Compute stacked page layouts when in Paged / A4 / Slide mode
  const { pageLayouts, totalStackHeight } = useMemo(() => {
    if (!isPagedMode) {
      return { pageLayouts: [] as PageLayout[], totalStackHeight: 0 };
    }
    const layouts: PageLayout[] = [];
    let curY = 0;
    pages.forEach((p, idx) => {
      const dims =
        p.pageSize === 'infinite'
          ? { width: 1120, height: 1584 }
          : PAGE_DIMENSIONS[p.pageSize];
      layouts.push({
        page: p,
        index: idx,
        x: -dims.width / 2,
        topY: curY,
        width: dims.width,
        height: dims.height,
      });
      curY += dims.height + PAGE_GAP;
    });
    return {
      pageLayouts: layouts,
      totalStackHeight: Math.max(0, curY - PAGE_GAP),
    };
  }, [isPagedMode, pages]);

  const activeLayout = useMemo(() => {
    if (!isPagedMode) return null;
    return pageLayouts.find((l) => l.page.id === page.id) || pageLayouts[0] || null;
  }, [isPagedMode, pageLayouts, page.id]);

  // Center & fit A4 page when entering Paged Mode
  useEffect(() => {
    if (isPagedMode && !wasPagedRef.current && activeLayout && canvasSize.width > 100) {
      const padX = canvasSize.width < 640 ? 24 : 140;
      const padY = canvasSize.height < 520 ? 36 : 64;
      const availW = Math.max(180, canvasSize.width - padX);
      const availH = Math.max(180, canvasSize.height - padY);
      const fitZ = Math.min(availW / activeLayout.width, availH / activeLayout.height, 0.95);
      const z = Math.max(0.2, Math.round(fitZ * 100) / 100);
      onViewportChange({
        zoom: z,
        offsetX: canvasSize.width / 2,
        offsetY: 28 - activeLayout.topY * z,
      });
    }
    wasPagedRef.current = isPagedMode;
  }, [isPagedMode, activeLayout, canvasSize.width, canvasSize.height, onViewportChange]);

  // Scroll to requested page when user clicks a thumbnail in Mục lục or Prev/Next buttons
  useEffect(() => {
    if (!scrollToPageRequest || scrollToPageRequest.seq === lastHandledScrollSeqRef.current) {
      return;
    }
    lastHandledScrollSeqRef.current = scrollToPageRequest.seq;
    if (!isPagedMode) return;
    const target = pageLayouts.find((l) => l.page.id === scrollToPageRequest.pageId);
    if (!target) return;
    onViewportChange((prev) => ({
      ...prev,
      offsetX: canvasSize.width / 2,
      offsetY: 28 - target.topY * prev.zoom,
    }));
  }, [scrollToPageRequest, isPagedMode, pageLayouts, canvasSize.width, onViewportChange]);

  const getScrollBounds = useCallback(
    (zoom: number) => {
      const maxOffsetY = Math.max(48, canvasSize.height * 0.2);
      const minOffsetY = Math.min(
        maxOffsetY,
        canvasSize.height - 72 - totalStackHeight * zoom
      );
      return { minOffsetY, maxOffsetY };
    },
    [canvasSize.height, totalStackHeight]
  );

  const syncActivePageFromOffsetY = useCallback(
    (nextOffsetY: number, zoom: number) => {
      if (!isPagedMode || pageLayouts.length <= 1) return;
      const worldCenterY = (canvasSize.height / 2 - nextOffsetY) / zoom;
      let matched = pageLayouts[0];
      let bestDist = Infinity;
      for (const L of pageLayouts) {
        if (worldCenterY >= L.topY - PAGE_GAP / 2 && worldCenterY <= L.topY + L.height + PAGE_GAP / 2) {
          matched = L;
          break;
        }
        const center = L.topY + L.height / 2;
        const d = Math.abs(worldCenterY - center);
        if (d < bestDist) {
          bestDist = d;
          matched = L;
        }
      }
      if (matched && matched.page.id !== page.id) {
        onSelectPage(matched.page.id);
      }
    },
    [isPagedMode, pageLayouts, canvasSize.height, page.id, onSelectPage]
  );

  const findPageTargetAtWorld = useCallback(
    (pt: { x: number; y: number }): { page: BoardPage; offsetX: number; offsetY: number } => {
      if (!isPagedMode || pageLayouts.length === 0) {
        return { page, offsetX: 0, offsetY: 0 };
      }
      const exact = pageLayouts.find(
        (L) =>
          pt.x >= L.x &&
          pt.x <= L.x + L.width &&
          pt.y >= L.topY &&
          pt.y <= L.topY + L.height
      );
      if (exact) {
        return { page: exact.page, offsetX: exact.x, offsetY: exact.topY };
      }
      const band = pageLayouts.find(
        (L) =>
          pt.y >= L.topY - PAGE_GAP / 2 && pt.y <= L.topY + L.height + PAGE_GAP / 2
      );
      if (band) {
        return { page: band.page, offsetX: band.x, offsetY: band.topY };
      }
      const fallback =
        pt.y < pageLayouts[0].topY
          ? pageLayouts[0]
          : pageLayouts[pageLayouts.length - 1];
      return { page: fallback.page, offsetX: fallback.x, offsetY: fallback.topY };
    },
    [isPagedMode, pageLayouts, page]
  );

  const displayedActiveElements = useMemo(() => {
    if (liveElements && liveElements.pageId === page.id) {
      return liveElements.items;
    }
    return page.elements;
  }, [liveElements, page.id, page.elements]);

  const selectedElements = useMemo(
    () => displayedActiveElements.filter((el) => selectedIds.includes(el.id)),
    [displayedActiveElements, selectedIds]
  );

  const selectionBBox = useMemo(
    () => getCombinedBBox(selectedElements),
    [selectedElements]
  );

  const activeOffsetX = activeLayout ? activeLayout.x : 0;
  const activeOffsetY = activeLayout ? activeLayout.topY : 0;

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
        onCommitPageElements(page.id, next);
        onSelectedIdsChange([]);
      }
      if (e.key === 'Escape') {
        onSelectedIdsChange([]);
        setEditingText(null);
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
  }, [page.id, page.elements, selectedIds, onCommitPageElements, onSelectedIdsChange]);

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

    if (!isPagedMode) {
      // Single Infinite Board Mode
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

      for (const el of displayedActiveElements) {
        if (editingText && editingText.pageId === page.id && editingText.elementId === el.id) {
          continue;
        }
        renderElement(ctx, el, imageCacheRef.current, () => {
          setRenderTick((t) => t + 1);
        });
      }

      if (liveDrawStroke && liveDrawStroke.pageId === page.id) {
        renderStroke(ctx, liveDrawStroke.stroke);
      }
      if (liveShape && liveShape.pageId === page.id) {
        renderShape(ctx, liveShape.shape);
      }
    } else {
      // Multi-Page Vertical Scroll Mode (A4 Portrait / A4 Landscape / 16:9 Slide)
      ctx.fillStyle = darkMode ? '#0F1115' : '#E5EAEF';
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

      ctx.save();
      ctx.translate(viewport.offsetX, viewport.offsetY);
      ctx.scale(viewport.zoom, viewport.zoom);

      const viewTop = -viewport.offsetY / viewport.zoom;
      const viewBottom = (canvasSize.height - viewport.offsetY) / viewport.zoom;

      for (const L of pageLayouts) {
        if (L.topY + L.height < viewTop - 250 || L.topY > viewBottom + 250) {
          continue;
        }

        const tpl = getTemplateColors(L.page.template);

        ctx.save();
        ctx.translate(L.x, L.topY);

        // Page card drop shadow
        ctx.save();
        ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
        ctx.shadowBlur = 28 / viewport.zoom;
        ctx.shadowOffsetY = 8 / viewport.zoom;
        ctx.fillStyle = tpl.bg;
        ctx.fillRect(0, 0, L.width, L.height);
        ctx.restore();

        // Realistic board/paper surface
        drawRealisticBoardSurface(ctx, L.page.template, 0, 0, L.width, L.height);

        // Clipped template pattern + elements + live strokes
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, L.width, L.height);
        ctx.clip();

        drawTemplatePattern(
          ctx,
          L.page.template,
          tpl.line,
          L.page.gridSize || 32,
          0,
          0,
          L.width,
          L.height
        );

        const pageElements =
          liveElements && liveElements.pageId === L.page.id
            ? liveElements.items
            : L.page.elements;

        for (const el of pageElements) {
          if (
            editingText &&
            editingText.pageId === L.page.id &&
            editingText.elementId === el.id
          ) {
            continue;
          }
          renderElement(ctx, el, imageCacheRef.current, () => {
            setRenderTick((t) => t + 1);
          });
        }

        if (liveDrawStroke && liveDrawStroke.pageId === L.page.id) {
          renderStroke(ctx, liveDrawStroke.stroke);
        }
        if (liveShape && liveShape.pageId === L.page.id) {
          renderShape(ctx, liveShape.shape);
        }
        ctx.restore();

        // Page frame / active highlight border
        if (L.page.pageSize === 'slide16x9') {
          drawAluminumBoardFrame(
            ctx,
            0,
            0,
            L.width,
            L.height,
            isDarkBoardTemplate(L.page.template),
            viewport.zoom
          );
        } else {
          const isActivePage = L.page.id === page.id;
          ctx.strokeStyle = isActivePage
            ? 'rgba(37, 99, 235, 0.55)'
            : 'rgba(15, 23, 42, 0.14)';
          ctx.lineWidth = (isActivePage ? 2 : 1) / viewport.zoom;
          ctx.strokeRect(0, 0, L.width, L.height);
        }

        // Subtle Page Number Label above top-left
        ctx.fillStyle = darkMode ? 'rgba(226, 232, 240, 0.7)' : 'rgba(71, 85, 105, 0.75)';
        ctx.font = `600 ${Math.max(11, Math.round(13 / viewport.zoom))}px "DM Sans", sans-serif`;
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Trang ${L.index + 1}`, 4, -8 / viewport.zoom);

        ctx.restore();
      }
    }

    // Lasso overlay (stored in page-local coords + offset)
    if (lassoPoints && lassoPoints.points.length > 1) {
      ctx.save();
      ctx.translate(lassoPoints.offsetX, lassoPoints.offsetY);
      ctx.strokeStyle = '#2563EB';
      ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
      ctx.lineWidth = 1.5 / viewport.zoom;
      ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
      ctx.beginPath();
      ctx.moveTo(lassoPoints.points[0].x, lassoPoints.points[0].y);
      for (let i = 1; i < lassoPoints.points.length; i++) {
        ctx.lineTo(lassoPoints.points[i].x, lassoPoints.points[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Box select overlay
    if (boxSelectRect) {
      ctx.save();
      ctx.translate(boxSelectRect.offsetX, boxSelectRect.offsetY);
      ctx.strokeStyle = '#2563EB';
      ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
      ctx.lineWidth = 1.5 / viewport.zoom;
      ctx.strokeRect(
        boxSelectRect.box.x,
        boxSelectRect.box.y,
        boxSelectRect.box.width,
        boxSelectRect.box.height
      );
      ctx.fillRect(
        boxSelectRect.box.x,
        boxSelectRect.box.y,
        boxSelectRect.box.width,
        boxSelectRect.box.height
      );
      ctx.restore();
    }

    // Eraser cursor ring (world space)
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

    // Laser pointer trail (world space)
    if (laserPointsRef.current.length > 0) {
      renderLaserTrail(ctx, laserPointsRef.current, performance.now());
    }

    ctx.restore();
    ctx.restore();
  }, [
    isPagedMode,
    page,
    pageLayouts,
    viewport,
    canvasSize,
    darkMode,
    displayedActiveElements,
    liveElements,
    liveDrawStroke,
    liveShape,
    lassoPoints,
    boxSelectRect,
    activeTool,
    eraserMode,
    eraserSize,
    cursorWorld,
    editingText,
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

  // Wheel zoom / vertical scroll in Paged Mode
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (isPagedMode && !e.ctrlKey && !e.metaKey) {
      onViewportChange((prev) => {
        const { minOffsetY, maxOffsetY } = getScrollBounds(prev.zoom);
        const nextOffsetY = Math.min(maxOffsetY, Math.max(minOffsetY, prev.offsetY - e.deltaY));
        const nextOffsetX = prev.offsetX - e.deltaX;
        syncActivePageFromOffsetY(nextOffsetY, prev.zoom);
        return {
          ...prev,
          offsetX: nextOffsetX,
          offsetY: nextOffsetY,
        };
      });
      return;
    }

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
    if (!editingText) return;
    const targetPage = pages.find((p) => p.id === editingText.pageId) || page;
    const target = targetPage.elements.find((e) => e.id === editingText.elementId);
    if (target && (target.type === 'text' || target.type === 'sticky')) {
      const trimmed = editingDraft.trim();
      if (target.type === 'text' && !trimmed) {
        onCommitPageElements(
          targetPage.id,
          targetPage.elements.filter((e) => e.id !== editingText.elementId)
        );
      } else {
        onCommitPageElements(
          targetPage.id,
          targetPage.elements.map((e) =>
            e.id === editingText.elementId ? { ...e, text: editingDraft } : e
          )
        );
      }
    }
    setEditingText(null);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editingText) {
      commitInlineText();
    }

    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer already released
      }
    }

    if (e.pointerType === 'touch') {
      activeTouchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouchPointersRef.current.size >= 2) {
        const pts = Array.from(activeTouchPointersRef.current.values());
        const p1 = pts[0];
        const p2 = pts[1];
        const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        pinchStateRef.current = {
          lastDist: Math.max(1, d),
          lastMidX: (p1.x + p2.x) / 2,
          lastMidY: (p1.y + p2.y) / 2,
        };
        if (interactionRef.current.type === 'draw') setLiveDrawStroke(null);
        if (interactionRef.current.type === 'shape') setLiveShape(null);
        setLiveElements(null);
        setLassoPoints(null);
        setBoxSelectRect(null);
        interactionRef.current = { type: 'none' };
        return;
      }
    }

    const isPalmTouch = stylusOnly && e.pointerType === 'touch';

    const pt = screenToWorld(e.clientX, e.clientY);
    setCursorWorld(pt);

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

    if (activeTool === 'laser') {
      laserPointsRef.current.push({ x: pt.x, y: pt.y, t: performance.now() });
      setRenderTick((t) => t + 1);
      return;
    }

    const target = findPageTargetAtWorld(pt);
    const targetPage = target.page;
    const offX = target.offsetX;
    const offY = target.offsetY;
    const localPt = { x: pt.x - offX, y: pt.y - offY };

    if (targetPage.id !== page.id) {
      onSelectPage(targetPage.id);
    }

    // Pen / Pencil / Highlighter
    if (activeTool === 'pen' || activeTool === 'pencil' || activeTool === 'highlighter') {
      const snap = snapPointToRuler(pt.x, pt.y, ruler);
      const localX = snap.x - offX;
      const localY = snap.y - offY;
      const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
      const stroke: StrokeItem = {
        id: uid('stroke'),
        type: 'stroke',
        tool: activeTool,
        color: activePenSlot.color,
        width: activePenSlot.width,
        opacity: activePenSlot.opacity,
        points: [{ x: localX, y: localY, pressure, t: Date.now() }],
      };
      interactionRef.current = {
        type: 'draw',
        pageId: targetPage.id,
        offsetX: offX,
        offsetY: offY,
        stroke,
        rulerSnapped: snap.snapped,
      };
      setLiveDrawStroke({ pageId: targetPage.id, stroke });
      onSelectedIdsChange([]);
      return;
    }

    // Eraser
    if (activeTool === 'eraser') {
      onSelectedIdsChange([]);
      if (eraserMode === 'stroke') {
        interactionRef.current = {
          type: 'eraseStroke',
          pageId: targetPage.id,
          offsetX: offX,
          offsetY: offY,
        };
        const filtered = targetPage.elements.filter((el) => !hitTestElement(el, localPt, 10));
        setLiveElements({
          pageId: targetPage.id,
          items: filtered.length !== targetPage.elements.length ? filtered : [...targetPage.elements],
        });
      } else {
        interactionRef.current = {
          type: 'erasePartial',
          pageId: targetPage.id,
          offsetX: offX,
          offsetY: offY,
        };
        const next: BoardElement[] = [];
        for (const el of targetPage.elements) {
          if (el.type === 'stroke') {
            next.push(...eraseStrokePartial(el, localPt, eraserSize / 2));
          } else {
            next.push(el);
          }
        }
        setLiveElements({ pageId: targetPage.id, items: next });
      }
      return;
    }

    // Shapes
    if (activeTool === 'shape') {
      const shape: ShapeItem = {
        id: uid('shape'),
        type: 'shape',
        shapeType: activeShape,
        x: localPt.x,
        y: localPt.y,
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
      interactionRef.current = {
        type: 'shape',
        pageId: targetPage.id,
        offsetX: offX,
        offsetY: offY,
        shape,
        startX: localPt.x,
        startY: localPt.y,
      };
      setLiveShape({ pageId: targetPage.id, shape });
      onSelectedIdsChange([]);
      return;
    }

    // Text tool
    if (activeTool === 'text') {
      const hitText = [...targetPage.elements]
        .reverse()
        .find((el) => (el.type === 'text' || el.type === 'sticky') && hitTestElement(el, localPt, 4));
      if (hitText && (hitText.type === 'text' || hitText.type === 'sticky')) {
        setEditingText({ pageId: targetPage.id, elementId: hitText.id });
        setEditingDraft(hitText.text);
        return;
      }

      const isDarkPaper = isDarkBoardTemplate(targetPage.template);
      const newText: TextItem = {
        id: uid('text'),
        type: 'text',
        x: localPt.x,
        y: localPt.y,
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
      onCommitPageElements(targetPage.id, [...targetPage.elements, newText]);
      setEditingText({ pageId: targetPage.id, elementId: newText.id });
      setEditingDraft('');
      onSelectTool('select');
      onSelectedIdsChange([newText.id]);
      return;
    }

    // Select tool
    if (activeTool === 'select') {
      if (targetPage.id === page.id && selectionBBox && selectedIds.length > 0) {
        if (
          localPt.x >= selectionBBox.x &&
          localPt.x <= selectionBBox.x + selectionBBox.width &&
          localPt.y >= selectionBBox.y &&
          localPt.y <= selectionBBox.y + selectionBBox.height
        ) {
          interactionRef.current = {
            type: 'moveSelected',
            pageId: targetPage.id,
            offsetX: offX,
            offsetY: offY,
            lastX: localPt.x,
            lastY: localPt.y,
            snapshot: targetPage.elements,
          };
          setLiveElements({ pageId: targetPage.id, items: targetPage.elements });
          return;
        }
      }

      const hit = [...targetPage.elements]
        .reverse()
        .find((el) => hitTestElement(el, localPt, 8 / viewport.zoom));

      if (hit) {
        if (e.shiftKey && targetPage.id === page.id) {
          const exists = selectedIds.includes(hit.id);
          onSelectedIdsChange(
            exists ? selectedIds.filter((id) => id !== hit.id) : [...selectedIds, hit.id]
          );
        } else {
          onSelectedIdsChange([hit.id]);
        }
        interactionRef.current = {
          type: 'moveSelected',
          pageId: targetPage.id,
          offsetX: offX,
          offsetY: offY,
          lastX: localPt.x,
          lastY: localPt.y,
          snapshot: targetPage.elements,
        };
        setLiveElements({ pageId: targetPage.id, items: targetPage.elements });
        return;
      }

      onSelectedIdsChange([]);
      if (selectMode === 'lasso') {
        interactionRef.current = {
          type: 'lasso',
          pageId: targetPage.id,
          offsetX: offX,
          offsetY: offY,
          points: [localPt],
        };
        setLassoPoints({ offsetX: offX, offsetY: offY, points: [localPt] });
      } else {
        interactionRef.current = {
          type: 'boxSelect',
          pageId: targetPage.id,
          offsetX: offX,
          offsetY: offY,
          startX: localPt.x,
          startY: localPt.y,
          curX: localPt.x,
          curY: localPt.y,
        };
        setBoxSelectRect({
          offsetX: offX,
          offsetY: offY,
          box: { x: localPt.x, y: localPt.y, width: 0, height: 0 },
        });
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch' && activeTouchPointersRef.current.has(e.pointerId)) {
      activeTouchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinchStateRef.current && activeTouchPointersRef.current.size >= 2) {
        const pts = Array.from(activeTouchPointersRef.current.values());
        const p1 = pts[0];
        const p2 = pts[1];
        const newDist = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
        const newMidX = (p1.x + p2.x) / 2;
        const newMidY = (p1.y + p2.y) / 2;

        const prevPinch = pinchStateRef.current;
        const scaleFactor = newDist / prevPinch.lastDist;
        const dx = newMidX - prevPinch.lastMidX;
        const dy = newMidY - prevPinch.lastMidY;

        const rect = canvasRef.current?.getBoundingClientRect();
        const anchorX = newMidX - (rect?.left ?? 0);
        const anchorY = newMidY - (rect?.top ?? 0);

        onViewportChange((prev) => {
          const nextZoom = Math.min(4, Math.max(0.2, prev.zoom * scaleFactor));
          const ratio = nextZoom / prev.zoom;
          const nextOffsetX = anchorX - (anchorX - (prev.offsetX + dx)) * ratio;
          const nextOffsetY = anchorY - (anchorY - (prev.offsetY + dy)) * ratio;
          if (isPagedMode) {
            syncActivePageFromOffsetY(nextOffsetY, nextZoom);
          }
          return {
            zoom: nextZoom,
            offsetX: nextOffsetX,
            offsetY: nextOffsetY,
          };
        });

        pinchStateRef.current = {
          lastDist: newDist,
          lastMidX: newMidX,
          lastMidY: newMidY,
        };
        return;
      }
    }

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
      onViewportChange((prev) => {
        const nextOffsetY = mode.origOffsetY + dy;
        if (isPagedMode) {
          syncActivePageFromOffsetY(nextOffsetY, prev.zoom);
        }
        return {
          ...prev,
          offsetX: mode.origOffsetX + dx,
          offsetY: nextOffsetY,
        };
      });
      return;
    }

    const localPt = { x: pt.x - mode.offsetX, y: pt.y - mode.offsetY };

    if (mode.type === 'draw') {
      const snap = snapPointToRuler(pt.x, pt.y, ruler);
      const nextPt: Point = {
        x: snap.x - mode.offsetX,
        y: snap.y - mode.offsetY,
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
        setLiveDrawStroke({ pageId: mode.pageId, stroke: updated });
      }
      return;
    }

    if (mode.type === 'shape') {
      let w = localPt.x - mode.startX;
      let h = localPt.y - mode.startY;
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
      setLiveShape({ pageId: mode.pageId, shape: updated });
      return;
    }

    if (mode.type === 'eraseStroke') {
      const targetPage = pages.find((p) => p.id === mode.pageId) || page;
      setLiveElements((prev) => ({
        pageId: mode.pageId,
        items: (prev?.pageId === mode.pageId ? prev.items : targetPage.elements).filter(
          (el) => !hitTestElement(el, localPt, 10)
        ),
      }));
      return;
    }

    if (mode.type === 'erasePartial') {
      const targetPage = pages.find((p) => p.id === mode.pageId) || page;
      setLiveElements((prev) => {
        const source = prev?.pageId === mode.pageId ? prev.items : targetPage.elements;
        const next: BoardElement[] = [];
        for (const el of source) {
          if (el.type === 'stroke') {
            next.push(...eraseStrokePartial(el, localPt, eraserSize / 2));
          } else {
            next.push(el);
          }
        }
        return { pageId: mode.pageId, items: next };
      });
      return;
    }

    if (mode.type === 'lasso') {
      const last = mode.points[mode.points.length - 1];
      if (!last || dist(last, localPt) >= 5) {
        mode.points.push(localPt);
        setLassoPoints({ offsetX: mode.offsetX, offsetY: mode.offsetY, points: [...mode.points] });
      }
      return;
    }

    if (mode.type === 'boxSelect') {
      mode.curX = localPt.x;
      mode.curY = localPt.y;
      const x = Math.min(mode.startX, localPt.x);
      const y = Math.min(mode.startY, localPt.y);
      const width = Math.abs(localPt.x - mode.startX);
      const height = Math.abs(localPt.y - mode.startY);
      setBoxSelectRect({
        offsetX: mode.offsetX,
        offsetY: mode.offsetY,
        box: { x, y, width, height },
      });
      return;
    }

    if (mode.type === 'moveSelected') {
      const dx = localPt.x - mode.lastX;
      const dy = localPt.y - mode.lastY;
      mode.lastX = localPt.x;
      mode.lastY = localPt.y;
      const targetPage = pages.find((p) => p.id === mode.pageId) || page;
      setLiveElements((prev) => ({
        pageId: mode.pageId,
        items: (prev?.pageId === mode.pageId ? prev.items : targetPage.elements).map((el) =>
          selectedIds.includes(el.id) ? translateElement(el, dx, dy) : el
        ),
      }));
      return;
    }

    if (mode.type === 'resizeSelected') {
      const { origBox, handle, snapshot } = mode;
      let nx = origBox.x;
      let ny = origBox.y;
      let nw = origBox.width;
      let nh = origBox.height;

      if (handle === 'se') {
        nw = Math.max(16, localPt.x - origBox.x);
        nh = Math.max(16, localPt.y - origBox.y);
      } else if (handle === 'nw') {
        nw = Math.max(16, origBox.x + origBox.width - localPt.x);
        nh = Math.max(16, origBox.y + origBox.height - localPt.y);
        nx = origBox.x + origBox.width - nw;
        ny = origBox.y + origBox.height - nh;
      } else if (handle === 'ne') {
        nw = Math.max(16, localPt.x - origBox.x);
        nh = Math.max(16, origBox.y + origBox.height - localPt.y);
        ny = origBox.y + origBox.height - nh;
      } else if (handle === 'sw') {
        nw = Math.max(16, origBox.x + origBox.width - localPt.x);
        nh = Math.max(16, localPt.y - origBox.y);
        nx = origBox.x + origBox.width - nw;
      }

      const newBox: BBox = { x: nx, y: ny, width: nw, height: nh };
      setLiveElements({
        pageId: mode.pageId,
        items: snapshot.map((el) =>
          selectedIds.includes(el.id) ? scaleElementInBox(el, origBox, newBox) : el
        ),
      });
      return;
    }

    if (mode.type === 'rotateSelected') {
      const curAngle =
        (Math.atan2(localPt.y - mode.center.y, localPt.x - mode.center.x) * 180) / Math.PI;
      const delta = curAngle - mode.startAngle;
      mode.lastDelta = delta;
      setLiveElements({
        pageId: mode.pageId,
        items: mode.snapshot.map((el) =>
          selectedIds.includes(el.id)
            ? rotateElementAround(el, mode.center, delta)
            : el
        ),
      });
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e && e.pointerType === 'touch') {
      activeTouchPointersRef.current.delete(e.pointerId);
      if (pinchStateRef.current) {
        if (activeTouchPointersRef.current.size < 2) {
          pinchStateRef.current = null;
          interactionRef.current = { type: 'none' };
        }
        return;
      }
    }

    const mode = interactionRef.current;
    interactionRef.current = { type: 'none' };

    if (mode.type === 'draw') {
      const targetPage = pages.find((p) => p.id === mode.pageId) || page;
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
      onCommitPageElements(targetPage.id, [...targetPage.elements, added]);
      return;
    }

    if (mode.type === 'shape') {
      const targetPage = pages.find((p) => p.id === mode.pageId) || page;
      setLiveShape(null);
      if (Math.hypot(mode.shape.width, mode.shape.height) >= 8) {
        onCommitPageElements(targetPage.id, [...targetPage.elements, mode.shape]);
      }
      return;
    }

    if (mode.type === 'eraseStroke' || mode.type === 'erasePartial') {
      if (liveElements && liveElements.pageId === mode.pageId) {
        onCommitPageElements(mode.pageId, liveElements.items);
      }
      setLiveElements(null);
      return;
    }

    if (mode.type === 'lasso') {
      const targetPage = pages.find((p) => p.id === mode.pageId) || page;
      const poly = mode.points;
      setLassoPoints(null);
      if (poly.length >= 3) {
        const matched = targetPage.elements
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
      const targetPage = pages.find((p) => p.id === mode.pageId) || page;
      const x = Math.min(mode.startX, mode.curX);
      const y = Math.min(mode.startY, mode.curY);
      const width = Math.abs(mode.curX - mode.startX);
      const height = Math.abs(mode.curY - mode.startY);
      setBoxSelectRect(null);
      if (width > 4 || height > 4) {
        const box = { x, y, width, height };
        const matched = targetPage.elements
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
      if (liveElements && liveElements.pageId === mode.pageId) {
        onCommitPageElements(mode.pageId, liveElements.items);
      }
      setLiveElements(null);
    }
  };

  // Double click to edit Text or Sticky note
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = screenToWorld(e.clientX, e.clientY);
    const target = findPageTargetAtWorld(pt);
    const localPt = { x: pt.x - target.offsetX, y: pt.y - target.offsetY };
    const hit = [...target.page.elements]
      .reverse()
      .find((el) => (el.type === 'text' || el.type === 'sticky') && hitTestElement(el, localPt, 6));
    if (hit && (hit.type === 'text' || hit.type === 'sticky')) {
      if (target.page.id !== page.id) onSelectPage(target.page.id);
      setEditingText({ pageId: target.page.id, elementId: hit.id });
      setEditingDraft(hit.text);
      onSelectedIdsChange([hit.id]);
    }
  };

  // Paste image from clipboard directly onto active page
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
              const centerW = (canvasSize.width / 2 - viewport.offsetX) / viewport.zoom - activeOffsetX;
              const centerH = (canvasSize.height / 2 - viewport.offsetY) / viewport.zoom - activeOffsetY;
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
              onCommitPageElements(page.id, [...page.elements, newImg]);
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
  }, [
    page.id,
    page.elements,
    canvasSize,
    viewport,
    activeOffsetX,
    activeOffsetY,
    onCommitPageElements,
    onSelectedIdsChange,
    onSelectTool,
  ]);

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
      nextAngle = ((nextAngle + 180) % 360) - 180;
      if (nextAngle < -180) nextAngle += 360;
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

  // Selection action handlers (on active page)
  const duplicateSelected = () => {
    const clones = selectedElements.map((el) => ({
      ...translateElement(el, 28, 28),
      id: uid(el.type),
    }));
    onCommitPageElements(page.id, [...page.elements, ...clones]);
    onSelectedIdsChange(clones.map((c) => c.id));
  };

  const deleteSelected = () => {
    onCommitPageElements(
      page.id,
      page.elements.filter((el) => !selectedIds.includes(el.id))
    );
    onSelectedIdsChange([]);
  };

  const reorderSelected = (dir: 'front' | 'back') => {
    const selected = page.elements.filter((el) => selectedIds.includes(el.id));
    const others = page.elements.filter((el) => !selectedIds.includes(el.id));
    const next = dir === 'front' ? [...others, ...selected] : [...selected, ...others];
    onCommitPageElements(page.id, next);
  };

  // Inline text element being edited
  const editingPage = editingText ? pages.find((p) => p.id === editingText.pageId) || page : null;
  const editingEl =
    editingText && editingPage
      ? editingPage.elements.find((e) => e.id === editingText.elementId) || null
      : null;
  const editingLayout =
    isPagedMode && editingPage
      ? pageLayouts.find((l) => l.page.id === editingPage.id) || null
      : null;
  const editingOffX = editingLayout ? editingLayout.x : 0;
  const editingOffY = editingLayout ? editingLayout.topY : 0;

  // Vertical scrollbar calculations for Paged Mode
  const scrollBounds = isPagedMode ? getScrollBounds(viewport.zoom) : null;
  const scrollRange = scrollBounds ? Math.max(1, scrollBounds.maxOffsetY - scrollBounds.minOffsetY) : 1;
  const scrollProgress = scrollBounds
    ? Math.min(1, Math.max(0, (scrollBounds.maxOffsetY - viewport.offsetY) / scrollRange))
    : 0;
  const thumbRatio =
    isPagedMode && totalStackHeight > 0
      ? Math.min(0.85, Math.max(0.08, canvasSize.height / (totalStackHeight * viewport.zoom + 120)))
      : 0.2;
  const trackH = Math.max(100, canvasSize.height - 24);
  const thumbH = Math.max(36, trackH * thumbRatio);
  const thumbTop = scrollProgress * (trackH - thumbH);

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

      {/* Right-Edge Interactive Scrollbar for Multi-Page A4 / Slide Mode */}
      {isPagedMode && pages.length >= 1 && (
        <div
          className="absolute right-1.5 top-3 bottom-3 w-2.5 z-20 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            scrollbarDragRef.current = {
              startY: e.clientY,
              origOffsetY: viewport.offsetY,
            };
          }}
          onPointerMove={(e) => {
            const drag = scrollbarDragRef.current;
            if (!drag || !scrollBounds) return;
            e.stopPropagation();
            const dy = e.clientY - drag.startY;
            const scrollableTrack = Math.max(1, trackH - thumbH);
            const deltaOffset = -(dy / scrollableTrack) * scrollRange;
            const nextY = Math.min(
              scrollBounds.maxOffsetY,
              Math.max(scrollBounds.minOffsetY, drag.origOffsetY + deltaOffset)
            );
            onViewportChange((prev) => ({ ...prev, offsetY: nextY }));
            syncActivePageFromOffsetY(nextY, viewport.zoom);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            scrollbarDragRef.current = null;
          }}
          onPointerCancel={() => {
            scrollbarDragRef.current = null;
          }}
        >
          <div
            style={{ height: thumbH, transform: `translateY(${thumbTop}px)` }}
            className="w-full rounded-full bg-slate-400/75 dark:bg-slate-500/75 hover:bg-slate-500 dark:hover:bg-slate-400 transition-colors"
          />
        </div>
      )}

      {/* Interactive Selection Overlay Handles & Floating Action Bar */}
      {activeTool === 'select' && selectionBBox && !editingText && (
        <div
          className="pointer-events-none absolute border-[1.5px] border-blue-600"
          style={{
            left: (selectionBBox.x + activeOffsetX) * viewport.zoom + viewport.offsetX,
            top: (selectionBBox.y + activeOffsetY) * viewport.zoom + viewport.offsetY,
            width: selectionBBox.width * viewport.zoom,
            height: selectionBBox.height * viewport.zoom,
          }}
        >
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

          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              const center = {
                x: selectionBBox.x + selectionBBox.width / 2,
                y: selectionBBox.y + selectionBBox.height / 2,
              };
              const pt = screenToWorld(e.clientX, e.clientY);
              const localPt = { x: pt.x - activeOffsetX, y: pt.y - activeOffsetY };
              const startAngle =
                (Math.atan2(localPt.y - center.y, localPt.x - center.x) * 180) / Math.PI;
              interactionRef.current = {
                type: 'rotateSelected',
                pageId: page.id,
                offsetX: activeOffsetX,
                offsetY: activeOffsetY,
                center,
                startAngle,
                lastDelta: 0,
                snapshot: page.elements,
              };
              setLiveElements({ pageId: page.id, items: page.elements });
              canvasRef.current?.setPointerCapture(e.pointerId);
            }}
            title="Xoay đối tượng"
            className="pointer-events-auto absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center cursor-grab shadow-xs"
          >
            <RotateCw className="w-2.5 h-2.5 text-blue-600" />
          </div>

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
                    pageId: page.id,
                    offsetX: activeOffsetX,
                    offsetY: activeOffsetY,
                    handle,
                    origBox: selectionBBox,
                    snapshot: page.elements,
                  };
                  setLiveElements({ pageId: page.id, items: page.elements });
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
            left: (editingEl.x + editingOffX) * viewport.zoom + viewport.offsetX,
            top: (editingEl.y + editingOffY) * viewport.zoom + viewport.offsetY,
            width: Math.max(160, editingEl.width * viewport.zoom),
            height: Math.max(80, editingEl.height * viewport.zoom),
            fontSize: `${editingEl.fontSize * viewport.zoom}px`,
            color: editingEl.type === 'text' ? editingEl.color : editingEl.textColor,
            backgroundColor:
              editingEl.type === 'sticky'
                ? editingEl.noteColor
                : editingEl.bgColor !== 'transparent'
                  ? editingEl.bgColor
                  : isDarkBoardTemplate(editingPage?.template || page.template)
                    ? 'rgba(20, 56, 40, 0.92)'
                    : 'rgba(255,255,255,0.9)',
          }}
          className="absolute z-20 p-2.5 rounded-lg border-2 border-blue-600 shadow-lg outline-none resize leading-snug font-sans"
        />
      )}

      {/* Interactive On-Canvas Magnetic Ruler */}
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

          <div className="px-2.5 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-xs font-mono-tabular font-semibold text-slate-800 dark:text-slate-100 shadow-xs">
            {Math.round(ruler.angleDeg)}°
          </div>

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

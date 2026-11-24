import {
  BoardElement,
  BoardPage,
  HighlightMode,
  ImageItem,
  PAGE_DIMENSIONS,
  PAPER_TEMPLATES,
  ShapeItem,
  StickyItem,
  StrokeItem,
  StrokeStyle,
  TextItem,
  ViewportState,
} from '../types/inkboard';

export interface LaserPoint {
  x: number;
  y: number;
  t: number;
}

export function getTemplateColors(templateId: BoardPage['template']) {
  return (
    PAPER_TEMPLATES.find((t) => t.id === templateId) ?? PAPER_TEMPLATES[0]
  );
}

export function isDarkBoardTemplate(templateId: BoardPage['template']): boolean {
  return (
    templateId === 'greenboard' ||
    templateId === 'greenboard_grid' ||
    templateId === 'chalkboard'
  );
}

// Procedural ceramic-steel greenboard & slate chalkboard texture cache
const texturePatternCache = new Map<string, CanvasPattern>();

function getBoardTexturePattern(
  ctx: CanvasRenderingContext2D,
  variant: 'green' | 'chalk'
): CanvasPattern | null {
  const cached = texturePatternCache.get(variant);
  if (cached) return cached;

  if (typeof document === 'undefined') return null;
  const tile = document.createElement('canvas');
  tile.width = 180;
  tile.height = 180;
  const tctx = tile.getContext('2d');
  if (!tctx) return null;

  // Base anti-glare mineral surface matching classroom greenboard (#1A4B3A)
  tctx.fillStyle = variant === 'green' ? '#1A4B3A' : '#1B2027';
  tctx.fillRect(0, 0, tile.width, tile.height);

  // Subtle deterministic micro-grain & wiped chalk-dust patina
  let seed = variant === 'green' ? 4219 : 8191;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 1400; i++) {
    const x = rand() * tile.width;
    const y = rand() * tile.height;
    const alpha = 0.012 + rand() * 0.025;
    tctx.fillStyle = rand() > 0.45
      ? `rgba(255, 255, 255, ${alpha})`
      : `rgba(0, 0, 0, ${alpha * 1.1})`;
    tctx.fillRect(x, y, 1.4, 1.4);
  }

  // Soft horizontal wiped-chalk smudge clouds
  for (let i = 0; i < 10; i++) {
    const cx = rand() * tile.width;
    const cy = rand() * tile.height;
    const r = 24 + rand() * 44;
    const grad = tctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    grad.addColorStop(0, 'rgba(235, 248, 240, 0.028)');
    grad.addColorStop(1, 'rgba(235, 248, 240, 0)');
    tctx.fillStyle = grad;
    tctx.beginPath();
    tctx.ellipse(cx, cy, r * 1.5, r * 0.7, 0, 0, Math.PI * 2);
    tctx.fill();
  }

  const pattern = ctx.createPattern(tile, 'repeat');
  if (pattern) {
    texturePatternCache.set(variant, pattern);
  }
  return pattern;
}

export function drawRealisticBoardSurface(
  ctx: CanvasRenderingContext2D,
  template: BoardPage['template'],
  x: number,
  y: number,
  width: number,
  height: number
) {
  const tpl = getTemplateColors(template);
  if (template === 'greenboard' || template === 'greenboard_grid') {
    // Pure single flat RAL 180 30 15 (#274C43) greenboard surface
    ctx.fillStyle = '#274C43';
    ctx.fillRect(x, y, width, height);
  } else if (template === 'chalkboard') {
    const pattern = getBoardTexturePattern(ctx, 'chalk');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(x, y, width, height);
    } else {
      ctx.fillStyle = tpl.bg;
      ctx.fillRect(x, y, width, height);
    }
  } else {
    ctx.fillStyle = tpl.bg;
    ctx.fillRect(x, y, width, height);
  }
}

export function drawAluminumBoardFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  isDarkBoard: boolean,
  zoom: number
) {
  ctx.save();
  const bezel = Math.max(8, 12);

  const grad = ctx.createLinearGradient(x, y, x + width, y + height);
  grad.addColorStop(0, '#CBD5E1');
  grad.addColorStop(0.5, '#E2E8F0');
  grad.addColorStop(1, '#94A3B8');

  ctx.strokeStyle = grad;
  ctx.lineWidth = bezel;
  ctx.strokeRect(x - bezel / 2, y - bezel / 2, width + bezel, height + bezel);

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = 1.5 / zoom;
  ctx.strokeRect(x, y, width, height);

  const trayHeight = 16;
  const trayY = y + height + bezel - 2;
  const trayGrad = ctx.createLinearGradient(0, trayY, 0, trayY + trayHeight);
  trayGrad.addColorStop(0, '#E2E8F0');
  trayGrad.addColorStop(0.45, '#CBD5E1');
  trayGrad.addColorStop(1, '#64748B');

  ctx.fillStyle = trayGrad;
  ctx.beginPath();
  ctx.roundRect(x - bezel, trayY, width + bezel * 2, trayHeight, 4);
  ctx.fill();

  const trayItemsX = x + 64;
  if (isDarkBoard) {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(trayItemsX, trayY - 5, 36, 5);
    ctx.fillStyle = '#FDE047';
    ctx.fillRect(trayItemsX + 44, trayY - 5, 32, 5);
    ctx.fillStyle = '#F9A8D4';
    ctx.fillRect(trayItemsX + 84, trayY - 5, 28, 5);
    ctx.fillStyle = '#78350F';
    ctx.fillRect(trayItemsX + 132, trayY - 10, 62, 10);
    ctx.fillStyle = '#334155';
    ctx.fillRect(trayItemsX + 132, trayY - 3, 62, 3);
  } else {
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(trayItemsX, trayY - 6, 48, 6);
    ctx.fillStyle = '#2563EB';
    ctx.fillRect(trayItemsX + 56, trayY - 6, 48, 6);
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(trayItemsX + 112, trayY - 6, 48, 6);
  }

  ctx.restore();
}

/**
 * Draw paper/board background & template lines either in viewport space or fixed export space.
 */
export function renderPaperBackground(
  ctx: CanvasRenderingContext2D,
  page: BoardPage,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  isDarkChrome: boolean
) {
  const tpl = getTemplateColors(page.template);

  // Outer workspace backdrop
  ctx.save();
  ctx.fillStyle = isDarkChrome ? '#0F1115' : '#E5EAEF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (page.pageSize === 'infinite') {
    ctx.save();
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.zoom, viewport.zoom);

    const worldLeft = -viewport.offsetX / viewport.zoom;
    const worldTop = -viewport.offsetY / viewport.zoom;
    const worldW = canvasWidth / viewport.zoom;
    const worldH = canvasHeight / viewport.zoom;

    drawRealisticBoardSurface(ctx, page.template, worldLeft, worldTop, worldW, worldH);

    drawTemplatePattern(
      ctx,
      page.template,
      tpl.line,
      page.gridSize || 32,
      worldLeft,
      worldTop,
      worldW,
      worldH
    );
    ctx.restore();
  } else {
    const dims = PAGE_DIMENSIONS[page.pageSize];
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.zoom, viewport.zoom);

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
    ctx.shadowBlur = 32 / viewport.zoom;
    ctx.shadowOffsetY = 10 / viewport.zoom;
    ctx.fillStyle = tpl.bg;
    ctx.fillRect(0, 0, dims.width, dims.height);
    ctx.restore();

    drawRealisticBoardSurface(ctx, page.template, 0, 0, dims.width, dims.height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dims.width, dims.height);
    ctx.clip();
    drawTemplatePattern(
      ctx,
      page.template,
      tpl.line,
      page.gridSize || 32,
      0,
      0,
      dims.width,
      dims.height
    );
    ctx.restore();

    if (page.pageSize === 'slide16x9') {
      drawAluminumBoardFrame(
        ctx,
        0,
        0,
        dims.width,
        dims.height,
        isDarkBoardTemplate(page.template),
        viewport.zoom
      );
    } else {
      ctx.strokeStyle = 'rgba(15,23,42,0.14)';
      ctx.lineWidth = 1 / viewport.zoom;
      ctx.strokeRect(0, 0, dims.width, dims.height);
    }
  }

  ctx.restore();
}

export function drawTemplatePattern(
  ctx: CanvasRenderingContext2D,
  template: BoardPage['template'],
  lineColor: string,
  gridSize: number,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (
    template === 'blank' ||
    template === 'ivory' ||
    template === 'chalkboard'
  ) {
    return;
  }

  const step = gridSize || 32;
  const startX = Math.floor(x / step) * step;
  const startY = Math.floor(y / step) * step;
  const endX = x + width;
  const endY = y + height;

  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.fillStyle = lineColor;
  ctx.lineWidth = 1;

  if (template === 'ruled') {
    ctx.beginPath();
    for (let py = startY; py <= endY; py += step) {
      ctx.moveTo(x, py);
      ctx.lineTo(endX, py);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.32)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(96, y);
    ctx.lineTo(96, endY);
    ctx.stroke();
  } else if (
    template === 'grid' ||
    template === 'greenboard' ||
    template === 'greenboard_grid'
  ) {
    ctx.beginPath();
    for (let px = startX; px <= endX; px += step) {
      ctx.moveTo(px, y);
      ctx.lineTo(px, endY);
    }
    for (let py = startY; py <= endY; py += step) {
      ctx.moveTo(x, py);
      ctx.lineTo(endX, py);
    }
    ctx.stroke();

    // Optional classroom 2-column vertical divider (yellow chalk divider like reference)
    if (template === 'greenboard_grid') {
      const splitX = width >= 1000 && x === 0 ? width / 2 : 760;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.58)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(splitX, y);
      ctx.lineTo(splitX, endY);
      ctx.stroke();
    }
  } else if (template === 'dots') {
    for (let px = startX; px <= endX; px += step) {
      for (let py = startY; py <= endY; py += step) {
        ctx.beginPath();
        ctx.arc(px, py, 1.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (template === 'music') {
    const staffGap = 10;
    const groupGap = staffGap * 11;
    const startGroup = Math.floor(y / groupGap) * groupGap;
    ctx.beginPath();
    for (let gy = startGroup; gy <= endY; gy += groupGap) {
      for (let line = 0; line < 5; line++) {
        const py = gy + line * staffGap;
        ctx.moveTo(x, py);
        ctx.lineTo(endX, py);
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}

function applyStrokeLineDash(
  ctx: CanvasRenderingContext2D,
  style: StrokeStyle,
  width: number
) {
  if (style === 'dashed') {
    const dashLen = Math.max(8, width * 3.1);
    const gapLen = Math.max(6, width * 2.1);
    ctx.setLineDash([dashLen, gapLen]);
  } else if (style === 'dotted') {
    ctx.lineCap = 'round';
    const gapLen = Math.max(5.5, width * 2.2);
    ctx.setLineDash([0.1, gapLen]);
  } else {
    ctx.setLineDash([]);
  }
}

function fillSmoothVariableInk(
  ctx: CanvasRenderingContext2D,
  rawPts: { x: number; y: number; pressure: number }[],
  baseWidth: number,
  isPen: boolean
) {
  if (rawPts.length === 0) return;
  if (rawPts.length === 1) {
    const r = Math.max(0.8, (baseWidth * (0.72 + (rawPts[0].pressure || 0.5) * 0.45)) / 2);
    ctx.beginPath();
    ctx.arc(rawPts[0].x, rawPts[0].y, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (rawPts.length === 2) {
    const pAvg = ((rawPts[0].pressure || 0.5) + (rawPts[1].pressure || 0.5)) / 2;
    ctx.lineWidth = Math.max(0.8, baseWidth * (0.75 + pAvg * 0.45));
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rawPts[0].x, rawPts[0].y);
    ctx.lineTo(rawPts[1].x, rawPts[1].y);
    ctx.stroke();
    return;
  }

  // Light spatial decimation prevents bunched micro-points from twisting normals on fast loops
  const minStep = Math.max(1.2, baseWidth * 0.24);
  const pts: { x: number; y: number; pressure: number }[] = [rawPts[0]];
  for (let i = 1; i < rawPts.length - 1; i++) {
    const prev = pts[pts.length - 1];
    const cur = rawPts[i];
    if (Math.hypot(cur.x - prev.x, cur.y - prev.y) >= minStep) {
      pts.push(cur);
    }
  }
  pts.push(rawPts[rawPts.length - 1]);

  if (pts.length <= 2) {
    ctx.lineWidth = Math.max(0.8, baseWidth);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
    return;
  }

  const n = pts.length;
  const radii: number[] = new Array(n);
  let prevR = Math.max(
    0.45,
    (baseWidth * (isPen ? 0.68 + (pts[0].pressure || 0.5) * 0.56 : 0.78 + (pts[0].pressure || 0.5) * 0.36)) / 2
  );
  for (let i = 0; i < n; i++) {
    const p = pts[i].pressure || 0.5;
    const factor = isPen ? 0.68 + p * 0.56 : 0.78 + p * 0.36;
    const targetR = Math.max(0.45, (baseWidth * factor) / 2);
    prevR = prevR * 0.55 + targetR * 0.45;
    radii[i] = prevR;
  }

  const left: { x: number; y: number }[] = new Array(n);
  const right: { x: number; y: number }[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const pPrev = pts[Math.max(0, i - 1)];
    const pNext = pts[Math.min(n - 1, i + 1)];
    let tx = pNext.x - pPrev.x;
    let ty = pNext.y - pPrev.y;
    const len = Math.hypot(tx, ty);
    if (len < 1e-4) {
      tx = 1;
      ty = 0;
    } else {
      tx /= len;
      ty /= len;
    }
    const nx = -ty;
    const ny = tx;
    const r = radii[i];
    left[i] = { x: pts[i].x + nx * r, y: pts[i].y + ny * r };
    right[i] = { x: pts[i].x - nx * r, y: pts[i].y - ny * r };
  }

  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);

  for (let i = 1; i < n - 1; i++) {
    const mx = (left[i].x + left[i + 1].x) / 2;
    const my = (left[i].y + left[i + 1].y) / 2;
    ctx.quadraticCurveTo(left[i].x, left[i].y, mx, my);
  }
  ctx.lineTo(left[n - 1].x, left[n - 1].y);

  // Smooth round end cap
  const endAngle = Math.atan2(left[n - 1].y - pts[n - 1].y, left[n - 1].x - pts[n - 1].x);
  ctx.arc(pts[n - 1].x, pts[n - 1].y, radii[n - 1], endAngle, endAngle + Math.PI, true);

  for (let i = n - 2; i >= 1; i--) {
    const mx = (right[i].x + right[i - 1].x) / 2;
    const my = (right[i].y + right[i - 1].y) / 2;
    ctx.quadraticCurveTo(right[i].x, right[i].y, mx, my);
  }
  ctx.lineTo(right[0].x, right[0].y);

  // Smooth round start cap
  const startAngle = Math.atan2(right[0].y - pts[0].y, right[0].x - pts[0].x);
  ctx.arc(pts[0].x, pts[0].y, radii[0], startAngle, startAngle + Math.PI, true);

  ctx.closePath();
  ctx.fill();
}

export function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: StrokeItem,
  isOverlay = false
) {
  const pts = stroke.points;
  if (pts.length === 0) return;

  const lineStyle: StrokeStyle = stroke.lineStyle || 'solid';

  ctx.save();
  ctx.globalAlpha = stroke.tool === 'pencil' ? stroke.opacity * 0.9 : stroke.opacity;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineJoin = 'round';

  if (stroke.tool === 'highlighter') {
    const hMode: HighlightMode = stroke.highlightMode || 'pdf';
    if (!isOverlay && (hMode === 'pdf' || hMode === 'block')) {
      ctx.globalCompositeOperation = 'multiply';
    }

    if (hMode === 'block' && pts.length >= 2) {
      const p0 = pts[0];
      const p1 = pts[pts.length - 1];
      const rx = Math.min(p0.x, p1.x);
      const ry = Math.min(p0.y, p1.y);
      const rw = Math.max(4, Math.abs(p1.x - p0.x));
      const rh = Math.max(4, Math.abs(p1.y - p0.y));
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 3);
      ctx.fill();
      if (lineStyle !== 'solid') {
        ctx.globalAlpha = Math.min(0.95, stroke.opacity + 0.25);
        ctx.lineWidth = Math.max(1.5, Math.min(4, stroke.width * 0.14));
        applyStrokeLineDash(ctx, lineStyle, ctx.lineWidth);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    ctx.lineCap =
      lineStyle === 'dotted'
        ? 'round'
        : hMode === 'marker'
          ? 'round'
          : 'butt';

    if (pts.length === 1) {
      const r = Math.max(2, stroke.width / 2);
      ctx.beginPath();
      if (hMode === 'pdf') {
        ctx.rect(pts[0].x - r * 0.6, pts[0].y - r, r * 1.2, r * 2);
      } else {
        ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.lineWidth = Math.max(1, stroke.width);
    applyStrokeLineDash(ctx, lineStyle, stroke.width);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.lineCap = lineStyle === 'dotted' ? 'round' : 'round';

  // Dashed / dotted pen & pencil strokes use one continuous quadratic path
  if (lineStyle !== 'solid') {
    if (pts.length === 1) {
      const r = Math.max(1, (stroke.width * (0.65 + (pts[0].pressure || 0.5) * 0.7)) / 2);
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.lineWidth = Math.max(0.8, stroke.width);
    applyStrokeLineDash(ctx, lineStyle, stroke.width);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Crisp single-fill variable-width ink (zero joint knots, zero lag)
  fillSmoothVariableInk(ctx, pts, stroke.width, stroke.tool === 'pen');
  ctx.restore();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - size * Math.cos(angle - Math.PI / 6),
    toY - size * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - size * Math.cos(angle + Math.PI / 6),
    toY - size * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

export function renderShape(ctx: CanvasRenderingContext2D, shape: ShapeItem) {
  ctx.save();

  const x = shape.width >= 0 ? shape.x : shape.x + shape.width;
  const y = shape.height >= 0 ? shape.y : shape.y + shape.height;
  const w = Math.abs(shape.width);
  const h = Math.abs(shape.height);
  const cx = x + w / 2;
  const cy = y + h / 2;

  if (shape.rotation) {
    ctx.translate(cx, cy);
    ctx.rotate((shape.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  ctx.strokeStyle = shape.strokeColor;
  ctx.lineWidth = shape.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const shapeStyle: StrokeStyle = shape.lineStyle ?? (shape.dashed ? 'dashed' : 'solid');
  if (shapeStyle !== 'solid') {
    applyStrokeLineDash(ctx, shapeStyle, shape.strokeWidth);
  }

  const hasFill = shape.fillColor && shape.fillColor !== 'transparent' && shape.fillOpacity > 0;

  const finishPath = (close = true) => {
    if (close) ctx.closePath();
    if (hasFill) {
      ctx.save();
      ctx.globalAlpha = shape.fillOpacity;
      ctx.fillStyle = shape.fillColor;
      ctx.fill();
      ctx.restore();
    }
    ctx.stroke();
  };

  switch (shape.shapeType) {
    case 'line': {
      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
      ctx.stroke();
      break;
    }
    case 'arrow': {
      const x1 = shape.x;
      const y1 = shape.y;
      const x2 = shape.x + shape.width;
      const y2 = shape.y + shape.height;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      drawArrowHead(ctx, x1, y1, x2, y2, Math.max(12, shape.strokeWidth * 3.8));
      break;
    }
    case 'doubleArrow': {
      const x1 = shape.x;
      const y1 = shape.y;
      const x2 = shape.x + shape.width;
      const y2 = shape.y + shape.height;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      const head = Math.max(12, shape.strokeWidth * 3.8);
      drawArrowHead(ctx, x1, y1, x2, y2, head);
      drawArrowHead(ctx, x2, y2, x1, y1, head);
      break;
    }
    case 'rect': {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      finishPath(false);
      break;
    }
    case 'roundedRect': {
      const r = Math.min(20, w * 0.18, h * 0.18);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      finishPath(false);
      break;
    }
    case 'ellipse': {
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
      finishPath(false);
      break;
    }
    case 'triangle': {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      finishPath(true);
      break;
    }
    case 'rightTriangle': {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      finishPath(true);
      break;
    }
    case 'diamond': {
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, cy);
      ctx.lineTo(cx, y + h);
      ctx.lineTo(x, cy);
      finishPath(true);
      break;
    }
    case 'star': {
      const spikes = 5;
      const outerR = Math.min(w, h) / 2;
      const innerR = outerR * 0.44;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const px = cx + Math.cos(angle) * r * (w / Math.max(1, Math.min(w, h)));
        const py = cy + Math.sin(angle) * r * (h / Math.max(1, Math.min(w, h)));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      finishPath(true);
      break;
    }
    case 'axes': {
      const pad = 12;
      ctx.beginPath();
      ctx.moveTo(x + pad, cy);
      ctx.lineTo(x + w - pad, cy);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx, y + h - pad);
      ctx.lineTo(cx, y + pad);
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([]);
      drawArrowHead(ctx, x + pad, cy, x + w - pad, cy, 11);
      drawArrowHead(ctx, cx, y + h - pad, cx, y + pad, 11);

      const step = 32;
      ctx.lineWidth = Math.max(1, shape.strokeWidth * 0.65);
      ctx.beginPath();
      for (let tx = cx + step; tx < x + w - pad - 14; tx += step) {
        ctx.moveTo(tx, cy - 4);
        ctx.lineTo(tx, cy + 4);
      }
      for (let tx = cx - step; tx > x + pad + 14; tx -= step) {
        ctx.moveTo(tx, cy - 4);
        ctx.lineTo(tx, cy + 4);
      }
      for (let ty = cy + step; ty < y + h - pad - 14; ty += step) {
        ctx.moveTo(cx - 4, ty);
        ctx.lineTo(cx + 4, ty);
      }
      for (let ty = cy - step; ty > y + pad + 14; ty -= step) {
        ctx.moveTo(cx - 4, ty);
        ctx.lineTo(cx + 4, ty);
      }
      ctx.stroke();

      ctx.fillStyle = shape.strokeColor;
      ctx.font = 'italic 600 15px "DM Sans", sans-serif';
      ctx.fillText('x', x + w - pad - 4, cy + 18);
      ctx.fillText('y', cx + 10, y + pad + 10);
      ctx.fillText('O', cx - 16, cy + 16);
      ctx.restore();
      break;
    }
    case 'table': {
      const rows = shape.rows || 3;
      const cols = shape.cols || 3;
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      if (hasFill) {
        ctx.save();
        ctx.globalAlpha = shape.fillOpacity;
        ctx.fillStyle = shape.fillColor;
        ctx.fill();
        ctx.restore();
      }
      for (let r = 1; r < rows; r++) {
        const ry = y + (h * r) / rows;
        ctx.moveTo(x, ry);
        ctx.lineTo(x + w, ry);
      }
      for (let c = 1; c < cols; c++) {
        const cxLine = x + (w * c) / cols;
        ctx.moveTo(cxLine, y);
        ctx.lineTo(cxLine, y + h);
      }
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (para === '') {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export function renderTextItem(ctx: CanvasRenderingContext2D, item: TextItem) {
  ctx.save();
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  if (item.rotation) {
    ctx.translate(cx, cy);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  if (item.bgColor && item.bgColor !== 'transparent') {
    ctx.fillStyle = item.bgColor;
    ctx.beginPath();
    ctx.roundRect(item.x, item.y, item.width, item.height, 8);
    ctx.fill();
  }

  const fontStyle = `${item.italic ? 'italic ' : ''}${item.bold ? '700 ' : '400 '}${item.fontSize}px ${item.fontFamily || '"DM Sans", sans-serif'}`;
  ctx.font = fontStyle;
  ctx.fillStyle = item.color;
  ctx.textBaseline = 'top';

  const pad = 8;
  const maxW = Math.max(20, item.width - pad * 2);
  const lines = wrapLines(ctx, item.text || '', maxW);
  const lineHeight = item.fontSize * 1.35;

  lines.forEach((line, idx) => {
    const ly = item.y + pad + idx * lineHeight;
    let lx = item.x + pad;
    if (item.align === 'center') {
      ctx.textAlign = 'center';
      lx = item.x + item.width / 2;
    } else if (item.align === 'right') {
      ctx.textAlign = 'right';
      lx = item.x + item.width - pad;
    } else {
      ctx.textAlign = 'left';
    }
    ctx.fillText(line, lx, ly);
  });

  ctx.restore();
}

export function renderStickyItem(ctx: CanvasRenderingContext2D, item: StickyItem) {
  ctx.save();
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  if (item.rotation) {
    ctx.translate(cx, cy);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = item.noteColor;
  ctx.beginPath();
  ctx.roundRect(item.x, item.y, item.width, item.height, 6);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  ctx.fillRect(item.x, item.y, item.width, 10);

  ctx.font = `500 ${item.fontSize}px "DM Sans", sans-serif`;
  ctx.fillStyle = item.textColor;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const pad = 14;
  const maxW = Math.max(24, item.width - pad * 2);
  const lines = wrapLines(ctx, item.text || '', maxW);
  const lineHeight = item.fontSize * 1.38;

  lines.forEach((line, idx) => {
    const ly = item.y + 18 + idx * lineHeight;
    if (ly + lineHeight <= item.y + item.height - 6) {
      ctx.fillText(line, item.x + pad, ly);
    }
  });

  ctx.restore();
}

export function renderImageItem(
  ctx: CanvasRenderingContext2D,
  item: ImageItem,
  imageCache: Map<string, HTMLImageElement>,
  onImageLoad?: () => void
) {
  let img = imageCache.get(item.src);
  if (!img) {
    img = new Image();
    img.onload = () => {
      onImageLoad?.();
    };
    img.src = item.src;
    imageCache.set(item.src, img);
  }

  ctx.save();
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  if (item.rotation) {
    ctx.translate(cx, cy);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  ctx.globalAlpha = item.opacity ?? 1;
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, item.x, item.y, item.width, item.height);
  } else {
    ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.fillRect(item.x, item.y, item.width, item.height);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.strokeRect(item.x, item.y, item.width, item.height);
  }
  ctx.restore();
}

export function renderElement(
  ctx: CanvasRenderingContext2D,
  el: BoardElement,
  imageCache: Map<string, HTMLImageElement>,
  onImageLoad?: () => void
) {
  switch (el.type) {
    case 'stroke':
      renderStroke(ctx, el);
      break;
    case 'shape':
      renderShape(ctx, el);
      break;
    case 'text':
      renderTextItem(ctx, el);
      break;
    case 'sticky':
      renderStickyItem(ctx, el);
      break;
    case 'image':
      renderImageItem(ctx, el, imageCache, onImageLoad);
      break;
  }
}

export function renderLaserTrail(
  ctx: CanvasRenderingContext2D,
  points: LaserPoint[],
  now: number,
  ttlMs = 1100
) {
  const active = points.filter((p) => now - p.t < ttlMs);
  if (active.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 1; i < active.length; i++) {
    const p0 = active[i - 1];
    const p1 = active[i];
    const age = (now - p1.t) / ttlMs;
    const alpha = Math.max(0, 1 - age);

    ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.45})`;
    ctx.lineWidth = 10 * alpha + 2;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
    ctx.lineWidth = 3.5 * alpha + 1;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  const head = active[active.length - 1];
  const headAlpha = Math.max(0, 1 - (now - head.t) / ttlMs);
  ctx.fillStyle = `rgba(239, 68, 68, ${headAlpha * 0.5})`;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${headAlpha})`;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

import {
  BoardElement,
  OsnapSettings,
  ShapeItem,
  ShapeType,
  SnapType,
} from '../types/inkboard';
import { dist, distToSegment } from './geometry';

export interface EllipseSnapInfo {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
}

export interface SnapCandidate {
  x: number;
  y: number;
  type: SnapType;
  label: string;
  deferredEllipse?: EllipseSnapInfo;
}

export function isLinearShapeType(shapeType?: ShapeType): boolean {
  return shapeType === 'line' || shapeType === 'arrow' || shapeType === 'doubleArrow';
}

export const OSNAP_META: {
  type: SnapType;
  label: string;
  shortLabel: string;
  color: string;
  priority: number;
}[] = [
  { type: 'endpoint', label: 'Điểm cuối / Góc', shortLabel: 'Điểm cuối', color: '#10B981', priority: 1 },
  { type: 'intersection', label: 'Giao điểm', shortLabel: 'Giao điểm', color: '#F59E0B', priority: 2 },
  { type: 'midpoint', label: 'Trung điểm cạnh', shortLabel: 'Trung điểm', color: '#06B6D4', priority: 3 },
  { type: 'center', label: 'Tâm hình học', shortLabel: 'Tâm', color: '#10B981', priority: 4 },
  { type: 'quadrant', label: 'Điểm 1/4 đường tròn', shortLabel: 'Góc 1/4', color: '#22C55E', priority: 5 },
  { type: 'tangent', label: 'Tiếp điểm (Line ↔ Tròn)', shortLabel: 'Tiếp điểm', color: '#EC4899', priority: 6 },
  { type: 'perpendicular', label: 'Vuông góc (Perp)', shortLabel: 'Vuông góc', color: '#3B82F6', priority: 7 },
  { type: 'nearest', label: 'Điểm trên cạnh', shortLabel: 'Trên cạnh', color: '#64748B', priority: 8 },
];

const PRIORITY_MAP: Record<SnapType, number> = Object.fromEntries(
  OSNAP_META.map((m) => [m.type, m.priority])
) as Record<SnapType, number>;

const LABEL_MAP: Record<SnapType, string> = Object.fromEntries(
  OSNAP_META.map((m) => [m.type, m.shortLabel])
) as Record<SnapType, string>;

const COLOR_MAP: Record<SnapType, string> = Object.fromEntries(
  OSNAP_META.map((m) => [m.type, m.color])
) as Record<SnapType, string>;

function rotateAround(
  px: number,
  py: number,
  cx: number,
  cy: number,
  deg: number
): { x: number; y: number } {
  if (!deg) return { x: px, y: py };
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * c - dy * s,
    y: cy + dx * s + dy * c,
  };
}

function unrotateAround(
  px: number,
  py: number,
  cx: number,
  cy: number,
  deg: number
): { x: number; y: number } {
  return rotateAround(px, py, cx, cy, -deg);
}

interface Seg {
  a: { x: number; y: number };
  b: { x: number; y: number };
  shapeId: string;
}

function getShapeSegmentsAndPoints(shape: ShapeItem): {
  endpoints: { x: number; y: number }[];
  midpoints: { x: number; y: number }[];
  centers: { x: number; y: number }[];
  quadrants: { x: number; y: number }[];
  segments: Seg[];
  ellipseInfo?: { cx: number; cy: number; rx: number; ry: number; rot: number };
} {
  const x = shape.width >= 0 ? shape.x : shape.x + shape.width;
  const y = shape.height >= 0 ? shape.y : shape.y + shape.height;
  const w = Math.abs(shape.width);
  const h = Math.abs(shape.height);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rot = shape.rotation || 0;
  const R = (px: number, py: number) => rotateAround(px, py, cx, cy, rot);

  const endpoints: { x: number; y: number }[] = [];
  const midpoints: { x: number; y: number }[] = [];
  const centers: { x: number; y: number }[] = [];
  const quadrants: { x: number; y: number }[] = [];
  const segments: Seg[] = [];

  const pushPoly = (verts: { x: number; y: number }[], closed = true) => {
    const rVerts = verts.map((v) => R(v.x, v.y));
    endpoints.push(...rVerts);
    const count = closed ? rVerts.length : rVerts.length - 1;
    for (let i = 0; i < count; i++) {
      const a = rVerts[i];
      const b = rVerts[(i + 1) % rVerts.length];
      midpoints.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      segments.push({ a, b, shapeId: shape.id });
    }
  };

  switch (shape.shapeType) {
    case 'line':
    case 'arrow':
    case 'doubleArrow': {
      const p1 = R(shape.x, shape.y);
      const p2 = R(shape.x + shape.width, shape.y + shape.height);
      endpoints.push(p1, p2);
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      midpoints.push(mid);
      centers.push(mid);
      segments.push({ a: p1, b: p2, shapeId: shape.id });
      break;
    }
    case 'rect':
    case 'roundedRect': {
      pushPoly([
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ]);
      centers.push({ x: cx, y: cy });
      break;
    }
    case 'table': {
      pushPoly([
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ]);
      const rows = shape.rows || 3;
      const cols = shape.cols || 3;
      for (let r = 1; r < rows; r++) {
        const ry = y + (h * r) / rows;
        const a = R(x, ry);
        const b = R(x + w, ry);
        endpoints.push(a, b);
        segments.push({ a, b, shapeId: shape.id });
      }
      for (let c = 1; c < cols; c++) {
        const cxLine = x + (w * c) / cols;
        const a = R(cxLine, y);
        const b = R(cxLine, y + h);
        endpoints.push(a, b);
        segments.push({ a, b, shapeId: shape.id });
      }
      centers.push({ x: cx, y: cy });
      break;
    }
    case 'ellipse': {
      const rx = Math.max(1, w / 2);
      const ry = Math.max(1, h / 2);
      centers.push({ x: cx, y: cy });
      quadrants.push(
        R(cx + rx, cy),
        R(cx, cy + ry),
        R(cx - rx, cy),
        R(cx, cy - ry)
      );
      return {
        endpoints,
        midpoints,
        centers,
        quadrants,
        segments,
        ellipseInfo: { cx, cy, rx, ry, rot },
      };
    }
    case 'triangle': {
      pushPoly([
        { x: x + w / 2, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ]);
      centers.push(R(x + w / 2, y + (h * 2) / 3));
      break;
    }
    case 'rightTriangle': {
      pushPoly([
        { x, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ]);
      centers.push(R(x + w / 3, y + (h * 2) / 3));
      break;
    }
    case 'diamond': {
      pushPoly([
        { x: cx, y },
        { x: x + w, y: cy },
        { x: cx, y: y + h },
        { x, y: cy },
      ]);
      centers.push({ x: cx, y: cy });
      break;
    }
    case 'star': {
      const spikes = 5;
      const outerR = Math.min(w, h) / 2;
      const innerR = outerR * 0.44;
      const verts: { x: number; y: number }[] = [];
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        verts.push({
          x: cx + Math.cos(angle) * r * (w / Math.max(1, Math.min(w, h))),
          y: cy + Math.sin(angle) * r * (h / Math.max(1, Math.min(w, h))),
        });
      }
      pushPoly(verts);
      centers.push({ x: cx, y: cy });
      break;
    }
    case 'axes': {
      const pad = 12;
      const hA = R(x + pad, cy);
      const hB = R(x + w - pad, cy);
      const vA = R(cx, y + h - pad);
      const vB = R(cx, y + pad);
      endpoints.push(hA, hB, vA, vB);
      centers.push({ x: cx, y: cy });
      segments.push({ a: hA, b: hB, shapeId: shape.id });
      segments.push({ a: vA, b: vB, shapeId: shape.id });
      break;
    }
  }

  return { endpoints, midpoints, centers, quadrants, segments };
}

function segIntersection(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number }
): { x: number; y: number } | null {
  const minAx = Math.min(a.x, b.x) - 1;
  const maxAx = Math.max(a.x, b.x) + 1;
  const minCx = Math.min(c.x, d.x) - 1;
  const maxCx = Math.max(c.x, d.x) + 1;
  if (maxAx < minCx || maxCx < minAx) return null;
  const minAy = Math.min(a.y, b.y) - 1;
  const maxAy = Math.max(a.y, b.y) + 1;
  const minCy = Math.min(c.y, d.y) - 1;
  const maxCy = Math.max(c.y, d.y) + 1;
  if (maxAy < minCy || maxCy < minAy) return null;

  const rX = b.x - a.x;
  const rY = b.y - a.y;
  const sX = d.x - c.x;
  const sY = d.y - c.y;
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 1e-6) return null;

  const t = ((c.x - a.x) * sY - (c.y - a.y) * sX) / denom;
  const u = ((c.x - a.x) * rY - (c.y - a.y) * rX) / denom;
  if (t < -1e-4 || t > 1 + 1e-4 || u < -1e-4 || u > 1 + 1e-4) return null;

  const tc = Math.max(0, Math.min(1, t));
  return {
    x: a.x + tc * rX,
    y: a.y + tc * rY,
  };
}

function closestPointOnEllipse(
  pt: { x: number; y: number },
  info: { cx: number; cy: number; rx: number; ry: number; rot: number }
): { x: number; y: number } {
  const local = unrotateAround(pt.x, pt.y, info.cx, info.cy, info.rot);
  const px = local.x - info.cx;
  const py = local.y - info.cy;
  if (Math.abs(info.rx - info.ry) < 0.4) {
    const len = Math.hypot(px, py);
    if (len < 1e-6) return rotateAround(info.cx + info.rx, info.cy, info.cx, info.cy, info.rot);
    const ex = info.cx + (px / len) * info.rx;
    const ey = info.cy + (py / len) * info.ry;
    return rotateAround(ex, ey, info.cx, info.cy, info.rot);
  }
  let theta = Math.atan2(py / info.ry, px / info.rx);
  for (let i = 0; i < 4; i++) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const ex = info.rx * c;
    const ey = info.ry * s;
    const dx = ex - px;
    const dy = ey - py;
    const tx = -info.rx * s;
    const ty = info.ry * c;
    const ddx = -info.rx * c;
    const ddy = -info.ry * s;
    const f = dx * tx + dy * ty;
    const df = tx * tx + ty * ty + dx * ddx + dy * ddy;
    if (Math.abs(df) < 1e-6) break;
    theta -= f / df;
  }
  const wx = info.cx + info.rx * Math.cos(theta);
  const wy = info.cy + info.ry * Math.sin(theta);
  return rotateAround(wx, wy, info.cx, info.cy, info.rot);
}

function tangentPointsOnEllipseFromPoint(
  fromPt: { x: number; y: number },
  info: { cx: number; cy: number; rx: number; ry: number; rot: number }
): { x: number; y: number }[] {
  if (info.rx < 2 || info.ry < 2) return [];
  const local = unrotateAround(fromPt.x, fromPt.y, info.cx, info.cy, info.rot);
  const ux = (local.x - info.cx) / info.rx;
  const uy = (local.y - info.cy) / info.ry;
  const d2 = ux * ux + uy * uy;
  if (d2 <= 1.0005) return []; // Point is inside or on the ellipse boundary

  const k = 1 / d2;
  const m = Math.sqrt(d2 - 1) / d2;

  const t1x = info.cx + (k * ux - m * uy) * info.rx;
  const t1y = info.cy + (k * uy + m * ux) * info.ry;
  const t2x = info.cx + (k * ux + m * uy) * info.rx;
  const t2y = info.cy + (k * uy - m * ux) * info.ry;

  return [
    rotateAround(t1x, t1y, info.cx, info.cy, info.rot),
    rotateAround(t2x, t2y, info.cx, info.cy, info.rot),
  ];
}

export function resolveDeferredTangentStart(
  ellipse: EllipseSnapInfo,
  targetPt: { x: number; y: number },
  anchorPt: { x: number; y: number }
): { x: number; y: number } | null {
  const pts = tangentPointsOnEllipseFromPoint(targetPt, ellipse);
  if (pts.length === 0) return null;
  if (pts.length === 1) return pts[0];
  return dist(pts[0], anchorPt) <= dist(pts[1], anchorPt) ? pts[0] : pts[1];
}

export function solveCommonTangent(
  e1: EllipseSnapInfo,
  anchor1: { x: number; y: number },
  e2: EllipseSnapInfo,
  anchor2: { x: number; y: number }
): { p1: { x: number; y: number }; p2: { x: number; y: number } } | null {
  let p1 = anchor1;
  let p2 = anchor2;
  for (let i = 0; i < 6; i++) {
    const nextP2 = resolveDeferredTangentStart(e2, p1, p2);
    if (!nextP2) return null;
    p2 = nextP2;
    const nextP1 = resolveDeferredTangentStart(e1, p2, p1);
    if (!nextP1) return null;
    p1 = nextP1;
  }
  return { p1, p2 };
}

export function findBestOsnap(
  elements: BoardElement[],
  cursor: { x: number; y: number },
  fromPt: { x: number; y: number } | null,
  osnap: OsnapSettings,
  thresholdWorld: number,
  options?: { drawingShapeType?: ShapeType }
): SnapCandidate | null {
  if (!osnap.enabled && !osnap.oneShot) return null;

  const isLinearDraw =
    !options?.drawingShapeType || isLinearShapeType(options.drawingShapeType);

  const isModeActive = (t: SnapType) =>
    osnap.oneShot ? osnap.oneShot === t : Boolean(osnap.modes[t]);

  const candidates: SnapCandidate[] = [];
  const add = (
    x: number,
    y: number,
    type: SnapType,
    deferredEllipse?: EllipseSnapInfo
  ) => {
    if (!isModeActive(type)) return;
    candidates.push({ x, y, type, label: LABEL_MAP[type], deferredEllipse });
  };

  const allSegments: Seg[] = [];

  for (const el of elements) {
    if (el.type === 'shape') {
      const geo = getShapeSegmentsAndPoints(el);
      if (isModeActive('endpoint')) {
        for (const p of geo.endpoints) add(p.x, p.y, 'endpoint');
      }
      if (isModeActive('midpoint')) {
        for (const p of geo.midpoints) add(p.x, p.y, 'midpoint');
      }
      if (isModeActive('center')) {
        for (const p of geo.centers) add(p.x, p.y, 'center');
      }
      if (isModeActive('quadrant')) {
        for (const p of geo.quadrants) add(p.x, p.y, 'quadrant');
      }
      if (geo.ellipseInfo) {
        if (isLinearDraw && isModeActive('tangent')) {
          if (fromPt) {
            const tangents = tangentPointsOnEllipseFromPoint(fromPt, geo.ellipseInfo);
            for (const t of tangents) add(t.x, t.y, 'tangent', geo.ellipseInfo);
          } else if (osnap.oneShot === 'tangent') {
            // Deferred tangent: allow clicking the circle first when one-shot Tangent is armed
            const pClose = closestPointOnEllipse(cursor, geo.ellipseInfo);
            add(pClose.x, pClose.y, 'tangent', geo.ellipseInfo);
          }
        }
        if (isLinearDraw && isModeActive('perpendicular') && fromPt) {
          const pClose = closestPointOnEllipse(fromPt, geo.ellipseInfo);
          add(pClose.x, pClose.y, 'perpendicular');
          // Opposite side perpendicular point through center
          const pFar = {
            x: 2 * geo.ellipseInfo.cx - pClose.x,
            y: 2 * geo.ellipseInfo.cy - pClose.y,
          };
          add(pFar.x, pFar.y, 'perpendicular');
        }
        if (isModeActive('nearest')) {
          const pNear = closestPointOnEllipse(cursor, geo.ellipseInfo);
          add(pNear.x, pNear.y, 'nearest');
        }
      }
      if (
        isModeActive('intersection') ||
        (isLinearDraw && isModeActive('perpendicular')) ||
        isModeActive('nearest')
      ) {
        allSegments.push(...geo.segments);
      }
    } else if (el.type === 'stroke') {
      if (el.points.length === 0) continue;
      if (el.highlightMode === 'block' && el.points.length >= 2) {
        const p0 = el.points[0];
        const p1 = el.points[el.points.length - 1];
        const x = Math.min(p0.x, p1.x);
        const y = Math.min(p0.y, p1.y);
        const w = Math.abs(p1.x - p0.x);
        const h = Math.abs(p1.y - p0.y);
        const corners = [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ];
        if (isModeActive('endpoint')) corners.forEach((c) => add(c.x, c.y, 'endpoint'));
        if (isModeActive('center')) add(x + w / 2, y + h / 2, 'center');
        for (let i = 0; i < 4; i++) {
          const a = corners[i];
          const b = corners[(i + 1) % 4];
          if (isModeActive('midpoint')) add((a.x + b.x) / 2, (a.y + b.y) / 2, 'midpoint');
          allSegments.push({ a, b, shapeId: el.id });
        }
      } else {
        const first = el.points[0];
        const last = el.points[el.points.length - 1];
        if (isModeActive('endpoint')) {
          add(first.x, first.y, 'endpoint');
          if (el.points.length > 1) add(last.x, last.y, 'endpoint');
        }
        if (isModeActive('midpoint') && el.points.length >= 2) {
          const midPt = el.points[Math.floor(el.points.length / 2)];
          add(midPt.x, midPt.y, 'midpoint');
        }
        if (isModeActive('nearest') && el.points.length >= 2) {
          let bestProj = el.points[0];
          let bestD = Infinity;
          for (let i = 0; i < el.points.length - 1; i++) {
            const { distance, proj } = distToSegment(cursor, el.points[i], el.points[i + 1]);
            if (distance < bestD) {
              bestD = distance;
              bestProj = { ...el.points[i], x: proj.x, y: proj.y };
            }
          }
          if (bestD <= thresholdWorld) {
            add(bestProj.x, bestProj.y, 'nearest');
          }
        }
      }
    } else if (el.type === 'text' || el.type === 'sticky' || (el.type === 'image' && !el.locked)) {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const rot = el.rotation || 0;
      const R = (px: number, py: number) => rotateAround(px, py, cx, cy, rot);
      const corners = [
        R(el.x, el.y),
        R(el.x + el.width, el.y),
        R(el.x + el.width, el.y + el.height),
        R(el.x, el.y + el.height),
      ];
      if (isModeActive('endpoint')) corners.forEach((c) => add(c.x, c.y, 'endpoint'));
      if (isModeActive('center')) add(cx, cy, 'center');
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        if (isModeActive('midpoint')) add((a.x + b.x) / 2, (a.y + b.y) / 2, 'midpoint');
        if (isModeActive('perpendicular') || isModeActive('nearest')) {
          allSegments.push({ a, b, shapeId: el.id });
        }
      }
    }
  }

  // Segment-derived snaps: Intersection, Perpendicular from `fromPt`, and Nearest
  if (isModeActive('intersection') && allSegments.length >= 2) {
    for (let i = 0; i < allSegments.length; i++) {
      const s1 = allSegments[i];
      for (let j = i + 1; j < allSegments.length; j++) {
        const s2 = allSegments[j];
        if (s1.shapeId === s2.shapeId) continue;
        const hit = segIntersection(s1.a, s1.b, s2.a, s2.b);
        if (hit) add(hit.x, hit.y, 'intersection');
      }
    }
  }

  if (isLinearDraw && isModeActive('perpendicular') && fromPt) {
    for (const seg of allSegments) {
      const dx = seg.b.x - seg.a.x;
      const dy = seg.b.y - seg.a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-4) continue;
      const t = ((fromPt.x - seg.a.x) * dx + (fromPt.y - seg.a.y) * dy) / len2;
      if (t >= 0 && t <= 1) {
        add(seg.a.x + t * dx, seg.a.y + t * dy, 'perpendicular');
      }
    }
  }

  if (isModeActive('nearest')) {
    for (const seg of allSegments) {
      const { distance, proj } = distToSegment(cursor, seg.a, seg.b);
      if (distance <= thresholdWorld) {
        add(proj.x, proj.y, 'nearest');
      }
    }
  }

  // Pick best candidate within thresholdWorld, prioritizing exact snaps over `nearest`
  let best: SnapCandidate | null = null;
  let bestScore = Infinity;

  for (const c of candidates) {
    const d = dist(cursor, c);
    const maxRadius =
      c.type === 'tangent'
        ? thresholdWorld * (osnap.oneShot === 'tangent' ? 1.5 : 1.2)
        : thresholdWorld;
    if (d > maxRadius) continue;
    // Weight exact geometric points heavily over `nearest`, and slightly break near-ties by priority
    const isNearestPenalty = c.type === 'nearest' ? thresholdWorld * 2 : 0;
    const score = d + PRIORITY_MAP[c.type] * 0.35 + isNearestPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best;
}

export function renderOsnapMarker(
  ctx: CanvasRenderingContext2D,
  snap: SnapCandidate,
  zoom: number
) {
  const s = 4.6 / zoom;
  const color = COLOR_MAP[snap.type] || '#10B981';

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.75 / zoom;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // White halo behind marker for dark & light board visibility
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3.5 / zoom;
  drawOsnapGlyph(ctx, snap.x, snap.y, snap.type, s);
  ctx.restore();

  drawOsnapGlyph(ctx, snap.x, snap.y, snap.type, s);

  // Label badge
  const fontSize = 10 / zoom;
  ctx.font = `600 ${fontSize}px "DM Sans", sans-serif`;
  const textW = ctx.measureText(snap.label).width;
  const padX = 4.5 / zoom;
  const padY = 2 / zoom;
  const bx = snap.x + 9 / zoom;
  const by = snap.y - 9 / zoom - fontSize - padY * 2;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.beginPath();
  ctx.roundRect(bx, by, textW + padX * 2, fontSize + padY * 2, 4 / zoom);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1 / zoom;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';
  ctx.fillText(snap.label, bx + padX, by + padY);
  ctx.restore();
}

function drawOsnapGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: SnapType,
  s: number
) {
  ctx.beginPath();
  switch (type) {
    case 'endpoint': {
      ctx.rect(x - s, y - s, s * 2, s * 2);
      ctx.stroke();
      break;
    }
    case 'midpoint': {
      ctx.moveTo(x, y - s * 1.15);
      ctx.lineTo(x + s * 1.05, y + s * 0.9);
      ctx.lineTo(x - s * 1.05, y + s * 0.9);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'center': {
      ctx.arc(x, y, s * 1.05, 0, Math.PI * 2);
      ctx.moveTo(x - s * 1.4, y);
      ctx.lineTo(x + s * 1.4, y);
      ctx.moveTo(x, y - s * 1.4);
      ctx.lineTo(x, y + s * 1.4);
      ctx.stroke();
      break;
    }
    case 'quadrant': {
      ctx.moveTo(x, y - s * 1.25);
      ctx.lineTo(x + s * 1.25, y);
      ctx.lineTo(x, y + s * 1.25);
      ctx.lineTo(x - s * 1.25, y);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'intersection': {
      ctx.moveTo(x - s, y - s);
      ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y - s);
      ctx.lineTo(x - s, y + s);
      ctx.stroke();
      break;
    }
    case 'perpendicular': {
      ctx.moveTo(x - s, y + s);
      ctx.lineTo(x + s, y + s);
      ctx.moveTo(x, y + s);
      ctx.lineTo(x, y - s);
      ctx.moveTo(x, y + s * 0.25);
      ctx.lineTo(x + s * 0.75, y + s * 0.25);
      ctx.lineTo(x + s * 0.75, y + s);
      ctx.stroke();
      break;
    }
    case 'tangent': {
      ctx.arc(x, y, s * 0.9, 0, Math.PI * 2);
      ctx.moveTo(x - s * 1.15, y - s * 1.15);
      ctx.lineTo(x + s * 1.15, y - s * 1.15);
      ctx.stroke();
      break;
    }
    case 'nearest': {
      ctx.moveTo(x - s, y - s);
      ctx.lineTo(x + s, y - s);
      ctx.lineTo(x - s, y + s);
      ctx.lineTo(x + s, y + s);
      ctx.closePath();
      ctx.stroke();
      break;
    }
  }
}

export function renderAngleHud(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  zoom: number,
  shiftSnapped: boolean
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 6) return;

  // Screen-friendly angle in [0, 360) where 0° is right, 90° up/down shown nicely
  const rawDeg = (Math.atan2(-dy, dx) * 180) / Math.PI;
  const deg = Math.round(((rawDeg % 360) + 360) % 360);
  const isOrtho = deg % 90 === 0;
  const is45 = deg % 45 === 0;

  ctx.save();
  // Draw faint polar alignment guide when holding Shift
  if (shiftSnapped && is45) {
    ctx.strokeStyle = isOrtho ? 'rgba(37, 99, 235, 0.35)' : 'rgba(16, 185, 129, 0.35)';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    const ext = Math.max(len + 60 / zoom, 120 / zoom);
    const ux = dx / len;
    const uy = dy / len;
    ctx.beginPath();
    ctx.moveTo(x1 - ux * (24 / zoom), y1 - uy * (24 / zoom));
    ctx.lineTo(x1 + ux * ext, y1 + uy * ext);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Angle + length badge
  const label = `${deg}° · ${Math.round(len)}px`;
  const fontSize = 11 / zoom;
  ctx.font = `600 ${fontSize}px "DM Sans", sans-serif`;
  const textW = ctx.measureText(label).width;
  const padX = 6 / zoom;
  const padY = 3 / zoom;
  const mx = (x1 + x2) / 2 + 10 / zoom;
  const my = (y1 + y2) / 2 + 12 / zoom;

  ctx.fillStyle = shiftSnapped
    ? isOrtho
      ? 'rgba(37, 99, 235, 0.92)'
      : 'rgba(5, 150, 105, 0.92)'
    : 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(mx, my, textW + padX * 2, fontSize + padY * 2, 5 / zoom);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';
  ctx.fillText(label, mx + padX, my + padY);
  ctx.restore();
}

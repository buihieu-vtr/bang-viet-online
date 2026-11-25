import {
  BoardElement,
  OsnapSettings,
  ShapeItem,
  ShapeType,
  SnapType,
} from '../types/inkboard';
import { dist, distToSegment } from './geometry';
import { getEllipseBasisFromControl, isSpatialShapeType } from './geometry3d';

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

  if (isSpatialShapeType(shape.shapeType) && shape.vertices && shape.vertices.length > 0) {
    const verts = shape.vertices;
    if (shape.shapeType === 'sphere3d' && verts.length >= 3) {
      const [center, rim] = verts;
      const r = Math.max(8, dist(center, rim));
      centers.push({ x: center.x, y: center.y });
      quadrants.push(
        { x: center.x + r, y: center.y },
        { x: center.x, y: center.y + r },
        { x: center.x - r, y: center.y },
        { x: center.x, y: center.y - r }
      );
      return {
        endpoints,
        midpoints,
        centers,
        quadrants,
        segments,
        ellipseInfo: { cx: center.x, cy: center.y, rx: r, ry: r, rot: 0 },
      };
    }

    if (shape.shapeType === 'cylinder3d' && verts.length >= 4) {
      const [topC, botC, rim, front] = verts;
      const { rx, ry, ux, uy, nx, ny } = getEllipseBasisFromControl(botC, rim, front);
      const tL = { x: topC.x - ux * rx, y: topC.y - uy * rx };
      const tR = { x: topC.x + ux * rx, y: topC.y + uy * rx };
      const bL = { x: botC.x - ux * rx, y: botC.y - uy * rx };
      const bR = { x: botC.x + ux * rx, y: botC.y + uy * rx };
      centers.push({ x: topC.x, y: topC.y }, { x: botC.x, y: botC.y });
      endpoints.push(tL, tR, bL, bR);
      quadrants.push(
        tL,
        tR,
        bL,
        bR,
        { x: topC.x + nx * ry, y: topC.y + ny * ry },
        { x: topC.x - nx * ry, y: topC.y - ny * ry },
        { x: botC.x + nx * ry, y: botC.y + ny * ry },
        { x: botC.x - nx * ry, y: botC.y - ny * ry }
      );
      segments.push(
        { a: tL, b: bL, shapeId: shape.id },
        { a: tR, b: bR, shapeId: shape.id },
        { a: topC, b: botC, shapeId: shape.id },
        { a: botC, b: bR, shapeId: shape.id }
      );
      return { endpoints, midpoints, centers, quadrants, segments };
    }

    if (shape.shapeType === 'cone3d' && verts.length >= 4) {
      const [apex, botC, rim, front] = verts;
      const { rx, ry, ux, uy, nx, ny } = getEllipseBasisFromControl(botC, rim, front);
      const bL = { x: botC.x - ux * rx, y: botC.y - uy * rx };
      const bR = { x: botC.x + ux * rx, y: botC.y + uy * rx };
      endpoints.push({ x: apex.x, y: apex.y }, bL, bR);
      centers.push({ x: botC.x, y: botC.y });
      quadrants.push(
        bL,
        bR,
        { x: botC.x + nx * ry, y: botC.y + ny * ry },
        { x: botC.x - nx * ry, y: botC.y - ny * ry }
      );
      segments.push(
        { a: apex, b: botC, shapeId: shape.id },
        { a: botC, b: bR, shapeId: shape.id }
      );
      return { endpoints, midpoints, centers, quadrants, segments };
    }

    const rVerts = verts.map((v) => R(v.x, v.y));
    endpoints.push(...rVerts);
    for (const edge of shape.edges || []) {
      const a = rVerts[edge.a];
      const b = rVerts[edge.b];
      if (!a || !b) continue;
      midpoints.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      segments.push({ a, b, shapeId: shape.id });
    }
    if (shape.shapeType === 'pyramidSquare' && rVerts.length >= 5) {
      const [, A, B, C, D] = rVerts;
      const baseO = {
        x: (A.x + B.x + C.x + D.x) / 4,
        y: (A.y + B.y + C.y + D.y) / 4,
      };
      centers.push(baseO);
      endpoints.push(baseO);
      segments.push({ a: rVerts[0], b: baseO, shapeId: shape.id });
    } else if (shape.shapeType === 'pyramidPerpFace' && rVerts.length >= 3) {
      const [S, A, B] = rVerts;
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const len2 = dx * dx + dy * dy;
      if (len2 > 1e-4) {
        const t = ((S.x - A.x) * dx + (S.y - A.y) * dy) / len2;
        const H = { x: A.x + t * dx, y: A.y + t * dy };
        endpoints.push(H);
        segments.push({ a: S, b: H, shapeId: shape.id });
      }
    } else if (rVerts.length > 0) {
      centers.push({
        x: rVerts.reduce((s, v) => s + v.x, 0) / rVerts.length,
        y: rVerts.reduce((s, v) => s + v.y, 0) / rVerts.length,
      });
    }
    return { endpoints, midpoints, centers, quadrants, segments };
  }

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

export interface MagneticGuide {
  kind: 'parallel' | 'perpendicular' | 'ortho';
  label: string;
  color: string;
  point: { x: number; y: number };
  rays: { from: { x: number; y: number }; to: { x: number; y: number } }[];
  refs?: { a: { x: number; y: number }; b: { x: number; y: number } }[];
  perpCorner?: {
    corner: { x: number; y: number };
    legA: { x: number; y: number };
    legB: { x: number; y: number };
  };
}

function angleDiffAbs(a: number, b: number): number {
  const d = ((((a - b) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return Math.abs(d);
}

function rayIntersection(
  p1: { x: number; y: number },
  ang1: number,
  p2: { x: number; y: number },
  ang2: number
): { x: number; y: number } | null {
  const rX = Math.cos(ang1);
  const rY = Math.sin(ang1);
  const sX = Math.cos(ang2);
  const sY = Math.sin(ang2);
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 0.08) return null;
  const t = ((p2.x - p1.x) * sY - (p2.y - p1.y) * sX) / denom;
  return { x: p1.x + t * rX, y: p1.y + t * rY };
}

function lineLineIntersection(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number }
): { x: number; y: number } | null {
  const rX = b.x - a.x;
  const rY = b.y - a.y;
  const sX = d.x - c.x;
  const sY = d.y - c.y;
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 1e-4) return null;
  const t = ((c.x - a.x) * sY - (c.y - a.y) * sX) / denom;
  return { x: a.x + t * rX, y: a.y + t * rY };
}

function collectElementSegments(elements: BoardElement[]): { a: { x: number; y: number }; b: { x: number; y: number } }[] {
  const out: { a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
  for (const el of elements) {
    if (el.type === 'shape') {
      const geo = getShapeSegmentsAndPoints(el);
      for (const s of geo.segments) {
        if (dist(s.a, s.b) >= 12) {
          out.push({ a: s.a, b: s.b });
        }
      }
    }
  }
  return out;
}

/**
 * Light magnetic snap for line / arrow drawing toward parallel (//), perpendicular (⊥), or horizontal/vertical.
 */
export function findMagneticLineSnap(
  elements: BoardElement[],
  startPt: { x: number; y: number },
  cursorPt: { x: number; y: number },
  zoom: number
): { point: { x: number; y: number }; guide: MagneticGuide } | null {
  const dx = cursorPt.x - startPt.x;
  const dy = cursorPt.y - startPt.y;
  const len = Math.hypot(dx, dy);
  if (len < 16 / zoom) return null;

  const rawAng = Math.atan2(dy, dx);
  const orthoTol = (2.6 * Math.PI) / 180;
  const segTol = (3.4 * Math.PI) / 180;

  interface Candidate {
    angle: number;
    err: number;
    score: number;
    kind: 'parallel' | 'perpendicular' | 'ortho';
    label: string;
    color: string;
    refSeg?: { a: { x: number; y: number }; b: { x: number; y: number } };
  }

  const candidates: Candidate[] = [];

  // 1. Horizontal & Vertical (0°, 90°, 180°, -90°)
  for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const err = angleDiffAbs(rawAng, ang);
    if (err <= orthoTol) {
      const isHoriz = ang === 0 || ang === Math.PI;
      candidates.push({
        angle: ang,
        err,
        score: err + 0.004, // let touching segment perp/parallel take priority if matched
        kind: 'ortho',
        label: isHoriz ? 'Nằm ngang' : 'Thẳng đứng',
        color: '#2563EB',
      });
    }
  }

  // 2. Existing shape segments (Parallel // & Perpendicular ⊥)
  const segs = collectElementSegments(elements);
  const touchDist = 8 / zoom;

  for (const seg of segs) {
    const segAng = Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x);
    const touchesStart = distToSegment(startPt, seg.a, seg.b).distance <= touchDist;
    const isAxisAligned =
      angleDiffAbs(segAng, 0) < 0.015 ||
      angleDiffAbs(segAng, Math.PI) < 0.015 ||
      angleDiffAbs(segAng, Math.PI / 2) < 0.015 ||
      angleDiffAbs(segAng, -Math.PI / 2) < 0.015;

    // Parallel (//)
    for (const pAng of [segAng, segAng + Math.PI]) {
      const err = angleDiffAbs(rawAng, pAng);
      if (err <= segTol) {
        if (isAxisAligned && !touchesStart) continue;
        candidates.push({
          angle: pAng,
          err,
          score: err - (touchesStart ? 0.015 : 0),
          kind: 'parallel',
          label: 'Song song //',
          color: '#0EA5E9',
          refSeg: seg,
        });
      }
    }

    // Perpendicular (⊥)
    for (const perpAng of [segAng + Math.PI / 2, segAng - Math.PI / 2]) {
      const err = angleDiffAbs(rawAng, perpAng);
      if (err <= segTol) {
        if (isAxisAligned && !touchesStart) continue;
        candidates.push({
          angle: perpAng,
          err,
          score: err - (touchesStart ? 0.018 : 0),
          kind: 'perpendicular',
          label: 'Vuông góc ⊥',
          color: '#8B5CF6',
          refSeg: seg,
        });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];

  const snappedEnd = {
    x: startPt.x + Math.cos(best.angle) * len,
    y: startPt.y + Math.sin(best.angle) * len,
  };

  let perpCorner: MagneticGuide['perpCorner'];
  if (best.kind === 'perpendicular' && best.refSeg) {
    const inter = lineLineIntersection(startPt, snappedEnd, best.refSeg.a, best.refSeg.b);
    if (inter) {
      const dA = dist(inter, best.refSeg.a);
      const dB = dist(inter, best.refSeg.b);
      const legRef = dA >= dB ? best.refSeg.a : best.refSeg.b;
      const legLine = dist(inter, startPt) >= dist(inter, snappedEnd) ? startPt : snappedEnd;
      if (dist(inter, legLine) > 4 / zoom && dist(inter, legRef) > 4 / zoom) {
        perpCorner = { corner: inter, legA: legLine, legB: legRef };
      }
    }
  }

  return {
    point: snappedEnd,
    guide: {
      kind: best.kind,
      label: best.label,
      color: best.color,
      point: snappedEnd,
      rays: [{ from: startPt, to: snappedEnd }],
      refs: best.refSeg ? [best.refSeg] : undefined,
      perpCorner,
    },
  };
}

/**
 * Light magnetic snap when dragging a vertex of a 3D / spatial shape toward parallel (//),
 * perpendicular (⊥), or vertical/horizontal alignment.
 */
export function findMagneticVertexSnap(
  shape: ShapeItem,
  vertexIdx: number,
  otherElements: BoardElement[],
  cursorPt: { x: number; y: number },
  zoom: number
): { point: { x: number; y: number }; guide: MagneticGuide } | null {
  const verts = shape.vertices;
  if (!verts || vertexIdx < 0 || vertexIdx >= verts.length) return null;

  // 1. Special curved/pyramid vertical & horizontal alignment helpers
  if (shape.shapeType === 'pyramidSquare' && vertexIdx === 0 && verts.length >= 5) {
    const [, A, B, C, D] = verts;
    const baseO = {
      x: (A.x + B.x + C.x + D.x) / 4,
      y: (A.y + B.y + C.y + D.y) / 4,
    };
    if (Math.abs(cursorPt.x - baseO.x) <= 7 / zoom) {
      const snapped = { x: baseO.x, y: cursorPt.y };
      return {
        point: snapped,
        guide: {
          kind: 'perpendicular',
          label: 'SO ⊥ đáy',
          color: '#8B5CF6',
          point: snapped,
          rays: [{ from: baseO, to: snapped }],
          perpCorner: { corner: baseO, legA: snapped, legB: C },
        },
      };
    }
  }

  if ((shape.shapeType === 'cylinder3d' || shape.shapeType === 'cone3d') && verts.length >= 4) {
    const baseO = verts[1];
    if (vertexIdx === 0 && Math.abs(cursorPt.x - baseO.x) <= 7 / zoom) {
      const snapped = { x: baseO.x, y: cursorPt.y };
      return {
        point: snapped,
        guide: {
          kind: 'perpendicular',
          label: 'Trục ⊥ đáy',
          color: '#8B5CF6',
          point: snapped,
          rays: [{ from: baseO, to: snapped }],
          perpCorner: { corner: baseO, legA: snapped, legB: verts[2] },
        },
      };
    }
    if (vertexIdx === 2 && Math.abs(cursorPt.y - baseO.y) <= 6 / zoom) {
      const snapped = { x: cursorPt.x, y: baseO.y };
      return {
        point: snapped,
        guide: {
          kind: 'ortho',
          label: 'Nằm ngang',
          color: '#2563EB',
          point: snapped,
          rays: [{ from: baseO, to: snapped }],
        },
      };
    }
  }

  // 2. Polyhedron / Polygon edge constraints
  const edges = shape.edges || [];
  if (edges.length === 0) return null;

  const neighborIdxs: number[] = [];
  const sameShapeOtherEdges: { a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
  const edgesByVertex = new Map<number, { a: { x: number; y: number }; b: { x: number; y: number } }[]>();

  for (const e of edges) {
    const va = verts[e.a];
    const vb = verts[e.b];
    if (!va || !vb) continue;
    if (e.a === vertexIdx) {
      neighborIdxs.push(e.b);
    } else if (e.b === vertexIdx) {
      neighborIdxs.push(e.a);
    } else {
      if (dist(va, vb) >= 8) {
        sameShapeOtherEdges.push({ a: va, b: vb });
      }
      if (!edgesByVertex.has(e.a)) edgesByVertex.set(e.a, []);
      if (!edgesByVertex.has(e.b)) edgesByVertex.set(e.b, []);
      edgesByVertex.get(e.a)!.push({ a: va, b: vb });
      edgesByVertex.get(e.b)!.push({ a: vb, b: va });
    }
  }

  if (neighborIdxs.length === 0) return null;

  const sceneSegments = collectElementSegments(otherElements);
  const orthoTol = (2.6 * Math.PI) / 180;
  const sameShapeTol = (3.8 * Math.PI) / 180;
  const sceneTol = (2.8 * Math.PI) / 180;

  interface RayCandidate {
    nbIdx: number;
    anchor: { x: number; y: number };
    angle: number;
    err: number;
    score: number;
    kind: 'parallel' | 'perpendicular' | 'ortho';
    label: string;
    color: string;
    refSeg?: { a: { x: number; y: number }; b: { x: number; y: number } };
  }

  const bestPerNeighbor = new Map<number, RayCandidate>();

  for (const nbIdx of neighborIdxs) {
    const anchor = verts[nbIdx];
    const dx = cursorPt.x - anchor.x;
    const dy = cursorPt.y - anchor.y;
    const len = Math.hypot(dx, dy);
    if (len < 14 / zoom) continue;
    const rawAng = Math.atan2(dy, dx);

    const candidates: RayCandidate[] = [];

    // Same-shape edges (Parallel // & Perpendicular ⊥)
    for (const seg of sameShapeOtherEdges) {
      const segAng = Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x);
      const isConnectedToAnchor =
        dist(seg.a, anchor) < 1 || dist(seg.b, anchor) < 1;

      if (!isConnectedToAnchor) {
        for (const pAng of [segAng, segAng + Math.PI]) {
          const err = angleDiffAbs(rawAng, pAng);
          if (err <= sameShapeTol) {
            candidates.push({
              nbIdx,
              anchor,
              angle: pAng,
              err,
              score: err - 0.015, // prioritize same-shape parallel
              kind: 'parallel',
              label: 'Song song //',
              color: '#0EA5E9',
              refSeg: seg,
            });
          }
        }
      }

      for (const perpAng of [segAng + Math.PI / 2, segAng - Math.PI / 2]) {
        const err = angleDiffAbs(rawAng, perpAng);
        if (err <= sameShapeTol) {
          candidates.push({
            nbIdx,
            anchor,
            angle: perpAng,
            err,
            score: err - (isConnectedToAnchor ? 0.018 : 0.008),
            kind: 'perpendicular',
            label: 'Vuông góc ⊥',
            color: '#8B5CF6',
            refSeg: seg,
          });
        }
      }
    }

    // Horizontal / Vertical relative to neighbor
    for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const err = angleDiffAbs(rawAng, ang);
      if (err <= orthoTol) {
        const isHoriz = ang === 0 || ang === Math.PI;
        candidates.push({
          nbIdx,
          anchor,
          angle: ang,
          err,
          score: err,
          kind: 'ortho',
          label: isHoriz ? 'Nằm ngang' : 'Thẳng đứng',
          color: '#2563EB',
        });
      }
    }

    // Scene segments from other elements
    for (const seg of sceneSegments) {
      const segAng = Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x);
      const isAxisAligned =
        angleDiffAbs(segAng, 0) < 0.015 ||
        angleDiffAbs(segAng, Math.PI) < 0.015 ||
        angleDiffAbs(segAng, Math.PI / 2) < 0.015 ||
        angleDiffAbs(segAng, -Math.PI / 2) < 0.015;
      if (isAxisAligned) continue;

      for (const pAng of [segAng, segAng + Math.PI]) {
        const err = angleDiffAbs(rawAng, pAng);
        if (err <= sceneTol) {
          candidates.push({
            nbIdx,
            anchor,
            angle: pAng,
            err,
            score: err + 0.006,
            kind: 'parallel',
            label: 'Song song //',
            color: '#0EA5E9',
            refSeg: seg,
          });
        }
      }
      for (const perpAng of [segAng + Math.PI / 2, segAng - Math.PI / 2]) {
        const err = angleDiffAbs(rawAng, perpAng);
        if (err <= sceneTol) {
          candidates.push({
            nbIdx,
            anchor,
            angle: perpAng,
            err,
            score: err + 0.006,
            kind: 'perpendicular',
            label: 'Vuông góc ⊥',
            color: '#8B5CF6',
            refSeg: seg,
          });
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.score - b.score);
      bestPerNeighbor.set(nbIdx, candidates[0]);
    }
  }

  const allWinners = Array.from(bestPerNeighbor.values()).sort((a, b) => a.score - b.score);
  if (allWinners.length === 0) return null;

  // Check if TWO distinct neighbors simultaneously snapped cleanly -> exact intersection!
  if (allWinners.length >= 2) {
    const r1 = allWinners[0];
    for (let i = 1; i < allWinners.length; i++) {
      const r2 = allWinners[i];
      const inter = rayIntersection(r1.anchor, r1.angle, r2.anchor, r2.angle);
      if (inter && dist(cursorPt, inter) <= 18 / zoom) {
        const refs: { a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
        if (r1.refSeg) refs.push(r1.refSeg);
        if (r2.refSeg) refs.push(r2.refSeg);
        const label =
          r1.kind === 'parallel' && r2.kind === 'parallel'
            ? 'Song song //'
            : r1.kind === 'perpendicular' || r2.kind === 'perpendicular'
              ? 'Vuông góc ⊥'
              : r1.label;
        return {
          point: inter,
          guide: {
            kind: r1.kind,
            label,
            color: r1.color,
            point: inter,
            rays: [
              { from: r1.anchor, to: inter },
              { from: r2.anchor, to: inter },
            ],
            refs: refs.length > 0 ? refs : undefined,
          },
        };
      }
    }
  }

  // Single ray projection
  const best = allWinners[0];
  const ux = Math.cos(best.angle);
  const uy = Math.sin(best.angle);
  const projLen = (cursorPt.x - best.anchor.x) * ux + (cursorPt.y - best.anchor.y) * uy;
  const snappedPt = {
    x: best.anchor.x + ux * projLen,
    y: best.anchor.y + uy * projLen,
  };

  let perpCorner: MagneticGuide['perpCorner'];
  if (best.kind === 'perpendicular' && best.refSeg) {
    const inter = lineLineIntersection(best.anchor, snappedPt, best.refSeg.a, best.refSeg.b);
    if (inter) {
      const legRef = dist(inter, best.refSeg.a) >= dist(inter, best.refSeg.b) ? best.refSeg.a : best.refSeg.b;
      const legLine = dist(inter, best.anchor) >= dist(inter, snappedPt) ? best.anchor : snappedPt;
      if (dist(inter, legLine) > 4 / zoom && dist(inter, legRef) > 4 / zoom) {
        perpCorner = { corner: inter, legA: legLine, legB: legRef };
      }
    }
  }

  return {
    point: snappedPt,
    guide: {
      kind: best.kind,
      label: best.label,
      color: best.color,
      point: snappedPt,
      rays: [{ from: best.anchor, to: snappedPt }],
      refs: best.refSeg ? [best.refSeg] : undefined,
      perpCorner,
    },
  };
}

export function renderMagneticGuide(
  ctx: CanvasRenderingContext2D,
  guide: MagneticGuide,
  zoom: number
) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Highlight reference segments faintly so user knows which edge is matched
  if (guide.refs && guide.refs.length > 0) {
    ctx.strokeStyle = guide.color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 3.5 / zoom;
    for (const r of guide.refs) {
      ctx.beginPath();
      ctx.moveTo(r.a.x, r.a.y);
      ctx.lineTo(r.b.x, r.b.y);
      ctx.stroke();

      // Parallel tick mark in middle of ref segment
      if (guide.kind === 'parallel') {
        const mx = (r.a.x + r.b.x) / 2;
        const my = (r.a.y + r.b.y) / 2;
        const ang = Math.atan2(r.b.y - r.a.y, r.b.x - r.a.x);
        const nx = -Math.sin(ang) * (5 / zoom);
        const ny = Math.cos(ang) * (5 / zoom);
        const ux = Math.cos(ang) * (3 / zoom);
        const uy = Math.sin(ang) * (3 / zoom);
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 1.6 / zoom;
        ctx.beginPath();
        ctx.moveTo(mx - ux - nx, my - uy - ny);
        ctx.lineTo(mx + ux + nx, my + uy + ny);
        ctx.moveTo(mx + ux - nx, my + uy - ny);
        ctx.lineTo(mx + ux * 3 + nx, my + uy * 3 + ny);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Draw dashed ray(s)
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = guide.color;
  ctx.lineWidth = 1.4 / zoom;
  ctx.setLineDash([5 / zoom, 4 / zoom]);
  for (const ray of guide.rays) {
    ctx.beginPath();
    ctx.moveTo(ray.from.x, ray.from.y);
    ctx.lineTo(ray.to.x, ray.to.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Perpendicular right-angle symbol
  if (guide.perpCorner) {
    const { corner, legA, legB } = guide.perpCorner;
    const da = dist(corner, legA);
    const db = dist(corner, legB);
    if (da > 4 / zoom && db > 4 / zoom) {
      const sz = Math.min(10 / zoom, da * 0.45, db * 0.45);
      const uax = ((legA.x - corner.x) / da) * sz;
      const uay = ((legA.y - corner.y) / da) * sz;
      const ubx = ((legB.x - corner.x) / db) * sz;
      const uby = ((legB.y - corner.y) / db) * sz;
      ctx.globalAlpha = 0.92;
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.moveTo(corner.x + uax, corner.y + uay);
      ctx.lineTo(corner.x + uax + ubx, corner.y + uay + uby);
      ctx.lineTo(corner.x + ubx, corner.y + uby);
      ctx.stroke();
    }
  }

  // Small magnetic snap ring on active point
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = guide.color;
  ctx.lineWidth = 2 / zoom;
  ctx.beginPath();
  ctx.arc(guide.point.x, guide.point.y, 4.2 / zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Compact floating label
  const fontSize = 10 / zoom;
  ctx.font = `600 ${fontSize}px "DM Sans", sans-serif`;
  const textW = ctx.measureText(guide.label).width;
  const padX = 5 / zoom;
  const padY = 2.2 / zoom;
  const bx = guide.point.x + 10 / zoom;
  const by = guide.point.y - 10 / zoom - fontSize - padY * 2;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.beginPath();
  ctx.roundRect(bx, by, textW + padX * 2, fontSize + padY * 2, 4 / zoom);
  ctx.fill();
  ctx.strokeStyle = guide.color;
  ctx.lineWidth = 1 / zoom;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';
  ctx.fillText(guide.label, bx + padX, by + padY);
  ctx.restore();
}


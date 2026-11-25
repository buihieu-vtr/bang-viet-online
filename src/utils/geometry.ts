import {
  BBox,
  BoardElement,
  Point,
  RulerState,
  ShapeItem,
  StrokeItem,
} from '../types/inkboard';
import { computeShapeBBoxFromVertices, hitTestSpatialShape } from './geometry3d';

export function uid(prefix = 'el'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distToSegment(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): { distance: number; proj: { x: number; y: number } } {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return { distance: dist(p, v), proj: { x: v.x, y: v.y } };
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
  return { distance: dist(p, proj), proj };
}

export function getElementBBox(el: BoardElement): BBox {
  if (el.type === 'stroke') {
    if (el.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    if (el.highlightMode === 'block' && el.points.length >= 2) {
      const p0 = el.points[0];
      const p1 = el.points[el.points.length - 1];
      const x = Math.min(p0.x, p1.x);
      const y = Math.min(p0.y, p1.y);
      return {
        x,
        y,
        width: Math.max(6, Math.abs(p1.x - p0.x)),
        height: Math.max(6, Math.abs(p1.y - p0.y)),
      };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of el.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = Math.max(4, el.width / 2);
    return {
      x: minX - pad,
      y: minY - pad,
      width: Math.max(4, maxX - minX + pad * 2),
      height: Math.max(4, maxY - minY + pad * 2),
    };
  }

  if (el.type === 'shape' && el.vertices && el.vertices.length > 0) {
    return computeShapeBBoxFromVertices(el);
  }

  // Rect-based item (may be negative width/height during creation, normalize)
  const x = el.width >= 0 ? el.x : el.x + el.width;
  const y = el.height >= 0 ? el.y : el.y + el.height;
  const width = Math.abs(el.width);
  const height = Math.abs(el.height);
  return { x, y, width, height };
}

export function getCombinedBBox(elements: BoardElement[]): BBox | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    const b = getElementBBox(el);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(10, maxX - minX),
    height: Math.max(10, maxY - minY),
  };
}

export function pointInPolygon(pt: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function bboxesIntersect(a: BBox, b: BBox): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

export function hitTestElement(
  el: BoardElement,
  pt: { x: number; y: number },
  tolerance = 10
): boolean {
  if (el.type === 'stroke') {
    if (el.highlightMode === 'block' && el.points.length >= 2) {
      const box = getElementBBox(el);
      return (
        pt.x >= box.x - tolerance &&
        pt.x <= box.x + box.width + tolerance &&
        pt.y >= box.y - tolerance &&
        pt.y <= box.y + box.height + tolerance
      );
    }
    const rad = Math.max(tolerance, el.width / 2 + 4);
    if (el.points.length === 1) {
      return dist(pt, el.points[0]) <= rad;
    }
    for (let i = 0; i < el.points.length - 1; i++) {
      const { distance } = distToSegment(pt, el.points[i], el.points[i + 1]);
      if (distance <= rad) return true;
    }
    return false;
  }

  const box = getElementBBox(el);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rot = -(el.rotation || 0) * (Math.PI / 180);
  const dx = pt.x - cx;
  const dy = pt.y - cy;
  const lx = dx * Math.cos(rot) - dy * Math.sin(rot) + cx;
  const ly = dx * Math.sin(rot) + dy * Math.cos(rot) + cy;

  if (el.type === 'shape' && el.vertices && el.vertices.length > 0) {
    return hitTestSpatialShape(el, pt, tolerance);
  }

  if (el.type === 'shape' && (el.shapeType === 'line' || el.shapeType === 'arrow' || el.shapeType === 'doubleArrow')) {
    const p1 = { x: el.x, y: el.y };
    const p2 = { x: el.x + el.width, y: el.y + el.height };
    return distToSegment(pt, p1, p2).distance <= Math.max(tolerance, el.strokeWidth + 6);
  }

  return (
    lx >= box.x - tolerance &&
    lx <= box.x + box.width + tolerance &&
    ly >= box.y - tolerance &&
    ly <= box.y + box.height + tolerance
  );
}

export function translateElement(el: BoardElement, dx: number, dy: number): BoardElement {
  if (el.type === 'stroke') {
    return {
      ...el,
      points: el.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    };
  }
  if (el.type === 'shape' && el.vertices && el.vertices.length > 0) {
    return {
      ...el,
      x: el.x + dx,
      y: el.y + dy,
      vertices: el.vertices.map((v) => ({ ...v, x: v.x + dx, y: v.y + dy })),
    };
  }
  return {
    ...el,
    x: el.x + dx,
    y: el.y + dy,
  };
}

export function scaleElementInBox(
  el: BoardElement,
  oldBox: BBox,
  newBox: BBox
): BoardElement {
  const sx = oldBox.width > 1 ? newBox.width / oldBox.width : 1;
  const sy = oldBox.height > 1 ? newBox.height / oldBox.height : 1;

  if (el.type === 'stroke') {
    return {
      ...el,
      points: el.points.map((p) => ({
        ...p,
        x: newBox.x + (p.x - oldBox.x) * sx,
        y: newBox.y + (p.y - oldBox.y) * sy,
      })),
    };
  }

  if (el.type === 'shape' && el.vertices && el.vertices.length > 0) {
    const scaledVerts = el.vertices.map((v) => ({
      ...v,
      x: newBox.x + (v.x - oldBox.x) * sx,
      y: newBox.y + (v.y - oldBox.y) * sy,
    }));
    const nextShape: ShapeItem = { ...el, vertices: scaledVerts };
    const b = computeShapeBBoxFromVertices(nextShape);
    return { ...nextShape, x: b.x, y: b.y, width: b.width, height: b.height };
  }

  return {
    ...el,
    x: newBox.x + (el.x - oldBox.x) * sx,
    y: newBox.y + (el.y - oldBox.y) * sy,
    width: el.width * sx,
    height: el.height * sy,
  };
}

export function rotateElementAround(
  el: BoardElement,
  center: { x: number; y: number },
  deltaDeg: number
): BoardElement {
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  if (el.type === 'stroke') {
    return {
      ...el,
      points: el.points.map((p) => {
        const dx = p.x - center.x;
        const dy = p.y - center.y;
        return {
          ...p,
          x: center.x + dx * cos - dy * sin,
          y: center.y + dx * sin + dy * cos,
        };
      }),
    };
  }

  if (el.type === 'shape' && el.vertices && el.vertices.length > 0) {
    const rotVerts = el.vertices.map((v) => {
      const dx = v.x - center.x;
      const dy = v.y - center.y;
      return {
        ...v,
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
      };
    });
    const nextShape: ShapeItem = { ...el, vertices: rotVerts, rotation: 0 };
    const b = computeShapeBBoxFromVertices(nextShape);
    return { ...nextShape, x: b.x, y: b.y, width: b.width, height: b.height };
  }

  const elCx = el.x + el.width / 2;
  const elCy = el.y + el.height / 2;
  const dx = elCx - center.x;
  const dy = elCy - center.y;
  const nx = center.x + dx * cos - dy * sin;
  const ny = center.y + dx * sin + dy * cos;

  return {
    ...el,
    x: nx - el.width / 2,
    y: ny - el.height / 2,
    rotation: ((el.rotation || 0) + deltaDeg) % 360,
  };
}

/**
 * Splits a stroke where an eraser circle of radius `radius` intersects it.
 */
export function eraseStrokePartial(
  stroke: StrokeItem,
  eraserCenter: { x: number; y: number },
  radius: number
): StrokeItem[] {
  if (stroke.highlightMode === 'block') {
    return hitTestElement(stroke, eraserCenter, radius) ? [] : [stroke];
  }
  const effectiveRad = radius + stroke.width * 0.35;
  let anyHit = false;
  const keptSegments: Point[][] = [];
  let current: Point[] = [];

  for (let i = 0; i < stroke.points.length; i++) {
    const pt = stroke.points[i];
    if (dist(pt, eraserCenter) <= effectiveRad) {
      anyHit = true;
      if (current.length >= 2) {
        keptSegments.push(current);
      }
      current = [];
    } else {
      // Also check segment intersection if previous point was outside
      if (current.length > 0) {
        const prev = current[current.length - 1];
        const { distance } = distToSegment(eraserCenter, prev, pt);
        if (distance <= effectiveRad) {
          anyHit = true;
          if (current.length >= 2) {
            keptSegments.push(current);
          }
          current = [pt];
          continue;
        }
      }
      current.push(pt);
    }
  }

  if (current.length >= 2) {
    keptSegments.push(current);
  }

  if (!anyHit) return [stroke];

  return keptSegments.map((pts, idx) => ({
    ...stroke,
    id: idx === 0 ? stroke.id : uid('stroke'),
    points: pts,
  }));
}

/**
 * Snap a world point magnetically to the interactive ruler's top or bottom edge.
 */
export function snapPointToRuler(
  wx: number,
  wy: number,
  ruler: RulerState,
  snapThreshold = 26
): { x: number; y: number; snapped: boolean } {
  if (!ruler.visible) return { x: wx, y: wy, snapped: false };

  const rad = (ruler.angleDeg * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  // Normal pointing "down" relative to ruler angle
  const nx = -uy;
  const ny = ux;

  const halfLen = ruler.length / 2;
  const halfThick = 34; // half of 68px ruler height

  // Project point into ruler local coordinates
  const dx = wx - ruler.x;
  const dy = wy - ruler.y;
  const along = dx * ux + dy * uy;
  const across = dx * nx + dy * ny;

  if (along < -halfLen - 20 || along > halfLen + 20) {
    return { x: wx, y: wy, snapped: false };
  }

  const clampedAlong = Math.max(-halfLen, Math.min(halfLen, along));

  // Check top edge (-halfThick) and bottom edge (+halfThick)
  const distTop = Math.abs(across - -halfThick);
  const distBottom = Math.abs(across - halfThick);

  if (distTop <= snapThreshold && distTop <= distBottom) {
    const edgeOffset = -halfThick - 2;
    return {
      x: ruler.x + clampedAlong * ux + edgeOffset * nx,
      y: ruler.y + clampedAlong * uy + edgeOffset * ny,
      snapped: true,
    };
  }

  if (distBottom <= snapThreshold) {
    const edgeOffset = halfThick + 2;
    return {
      x: ruler.x + clampedAlong * ux + edgeOffset * nx,
      y: ruler.y + clampedAlong * uy + edgeOffset * ny,
      snapped: true,
    };
  }

  return { x: wx, y: wy, snapped: false };
}

/**
 * Heuristic Ink-to-Shape recognition for freehand pen/pencil strokes.
 * Recognizes straight lines, circles/ellipses, rectangles, and triangles.
 */
export function recognizeInkShape(stroke: StrokeItem): ShapeItem | null {
  const pts = stroke.points;
  if (pts.length < 6) return null;

  let totalLen = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (i > 0) totalLen += dist(pts[i - 1], p);
  }

  const w = maxX - minX;
  const h = maxY - minY;
  if (totalLen < 35 || (w < 18 && h < 18)) return null;

  const start = pts[0];
  const end = pts[pts.length - 1];
  const endDist = dist(start, end);

  // 1. Straight line check
  const directDist = endDist;
  if (directDist > 30 && totalLen / directDist < 1.14) {
    // Verify max deviation from segment
    let maxDev = 0;
    for (const p of pts) {
      const d = distToSegment(p, start, end).distance;
      if (d > maxDev) maxDev = d;
    }
    if (maxDev < Math.max(14, directDist * 0.08)) {
      return {
        id: uid('shape'),
        type: 'shape',
        shapeType: 'line',
        x: start.x,
        y: start.y,
        width: end.x - start.x,
        height: end.y - start.y,
        rotation: 0,
        strokeColor: stroke.color,
        fillColor: 'transparent',
        fillOpacity: 0,
        strokeWidth: stroke.width,
        lineStyle: stroke.lineStyle || 'solid',
        dashed: stroke.lineStyle === 'dashed' || stroke.lineStyle === 'dotted',
      };
    }
  }

  // Must be reasonably closed for 2D shapes
  const diag = Math.hypot(w, h);
  if (endDist > Math.max(48, diag * 0.28)) return null;

  // 2. Ellipse / Circle check
  const cx = minX + w / 2;
  const cy = minY + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  if (rx > 10 && ry > 10) {
    let ellipseErrSum = 0;
    for (const p of pts) {
      const norm = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
      ellipseErrSum += Math.abs(norm - 1);
    }
    const meanEllipseErr = ellipseErrSum / pts.length;
    if (meanEllipseErr < 0.14) {
      // Snap near-square to perfect circle
      const isCircle = Math.abs(w - h) / Math.max(w, h) < 0.16;
      const finalSize = isCircle ? (w + h) / 2 : 0;
      return {
        id: uid('shape'),
        type: 'shape',
        shapeType: 'ellipse',
        x: isCircle ? cx - finalSize / 2 : minX,
        y: isCircle ? cy - finalSize / 2 : minY,
        width: isCircle ? finalSize : w,
        height: isCircle ? finalSize : h,
        rotation: 0,
        strokeColor: stroke.color,
        fillColor: 'transparent',
        fillOpacity: 0,
        strokeWidth: stroke.width,
        lineStyle: stroke.lineStyle || 'solid',
        dashed: stroke.lineStyle === 'dashed' || stroke.lineStyle === 'dotted',
      };
    }
  }

  // 3. Rectangle check (how closely points hug the bounding box perimeter)
  let rectErrSum = 0;
  for (const p of pts) {
    const dLeft = Math.abs(p.x - minX);
    const dRight = Math.abs(p.x - maxX);
    const dTop = Math.abs(p.y - minY);
    const dBottom = Math.abs(p.y - maxY);
    rectErrSum += Math.min(dLeft, dRight, dTop, dBottom);
  }
  const meanRectErr = rectErrSum / pts.length;
  if (meanRectErr < Math.max(14, diag * 0.065) && w > 20 && h > 20) {
    const isSquare = Math.abs(w - h) / Math.max(w, h) < 0.14;
    const side = (w + h) / 2;
    return {
      id: uid('shape'),
      type: 'shape',
      shapeType: 'rect',
      x: isSquare ? cx - side / 2 : minX,
      y: isSquare ? cy - side / 2 : minY,
      width: isSquare ? side : w,
      height: isSquare ? side : h,
      rotation: 0,
      strokeColor: stroke.color,
      fillColor: 'transparent',
      fillOpacity: 0,
      strokeWidth: stroke.width,
      lineStyle: stroke.lineStyle || 'solid',
      dashed: stroke.lineStyle === 'dashed' || stroke.lineStyle === 'dotted',
    };
  }

  // 4. Triangle check (detect if perimeter matches 3 vertices)
  const expectedTriPerimeter = w + Math.hypot(w / 2, h) * 2;
  if (Math.abs(totalLen - expectedTriPerimeter) / expectedTriPerimeter < 0.25 && w > 24 && h > 24) {
    return {
      id: uid('shape'),
      type: 'shape',
      shapeType: 'triangle',
      x: minX,
      y: minY,
      width: w,
      height: h,
      rotation: 0,
      strokeColor: stroke.color,
      fillColor: 'transparent',
      fillOpacity: 0,
      strokeWidth: stroke.width,
      lineStyle: stroke.lineStyle || 'solid',
      dashed: stroke.lineStyle === 'dashed' || stroke.lineStyle === 'dotted',
    };
  }

  return null;
}

import {
  BBox,
  ShapeEdge,
  ShapeItem,
  ShapeType,
  ShapeVertex,
  SpatialShapeKind,
  StrokeStyle,
} from '../types/inkboard';
import { dist, distToSegment, pointInPolygon } from './geometry';

export interface SpatialShapeCatalogEntry {
  id: SpatialShapeKind;
  label: string;
  shortLabel: string;
  group: 'plane' | 'pyramid' | 'prism' | 'round';
  description: string;
}

export const SPATIAL_SHAPE_CATALOG: SpatialShapeCatalogEntry[] = [
  {
    id: 'tetrahedron',
    label: 'Tứ diện (Chóp tam giác)',
    shortLabel: 'Tứ diện',
    group: 'pyramid',
    description: 'Chóp tam giác S.ABC có cạnh sau nét đứt',
  },
  {
    id: 'pyramidSquare',
    label: 'Chóp tứ giác đều',
    shortLabel: 'Chóp đều',
    group: 'pyramid',
    description: 'S.ABCD đáy vuông tâm O, đường cao SO vuông đáy',
  },
  {
    id: 'pyramidConvex',
    label: 'Chóp đa giác lồi',
    shortLabel: 'Chóp lồi',
    group: 'pyramid',
    description: 'Chóp ngũ giác lồi S.ABCDE kéo đỉnh tự do',
  },
  {
    id: 'pyramidPerpEdge',
    label: 'Chóp cạnh bên ⊥ đáy',
    shortLabel: 'Cạnh ⊥ đáy',
    group: 'pyramid',
    description: 'SA vuông góc đáy tại A, có ký hiệu góc vuông',
  },
  {
    id: 'pyramidPerpFace',
    label: 'Chóp mặt bên ⊥ đáy',
    shortLabel: 'Mặt ⊥ đáy',
    group: 'pyramid',
    description: 'Mặt (SAB) vuông đáy, đường cao SH ⊥ AB',
  },
  {
    id: 'prismTriRight',
    label: 'Lăng trụ đứng tam giác',
    shortLabel: 'LT đứng',
    group: 'prism',
    description: 'Lăng trụ đứng ABC.A\'B\'C\' cạnh bên vuông đáy',
  },
  {
    id: 'prismOblique',
    label: 'Lăng trụ xiên',
    shortLabel: 'LT xiên',
    group: 'prism',
    description: 'Lăng trụ xiên ABC.A\'B\'C\' nghiêng tự do',
  },
  {
    id: 'cuboid3d',
    label: 'Hình hộp / Lập phương 3D',
    shortLabel: 'Hình hộp',
    group: 'prism',
    description: 'Hình hộp 8 đỉnh có 3 cạnh khuất nét đứt',
  },
  {
    id: 'cylinder3d',
    label: 'Hình trụ 3D',
    shortLabel: 'Hình trụ',
    group: 'round',
    description: 'Hình trụ tròn xoay kèm trục O\'O và đáy khuất',
  },
  {
    id: 'cone3d',
    label: 'Hình nón 3D',
    shortLabel: 'Hình nón',
    group: 'round',
    description: 'Hình nón đỉnh S, đường cao SO và đáy elip khuất',
  },
  {
    id: 'sphere3d',
    label: 'Hình cầu 3D',
    shortLabel: 'Hình cầu',
    group: 'round',
    description: 'Mặt cầu tâm O kèm đường xích đạo 3D',
  },
  {
    id: 'parallelogram',
    label: 'Hình bình hành',
    shortLabel: 'Bình hành',
    group: 'plane',
    description: 'Hình bình hành 4 đỉnh kéo tự do',
  },
  {
    id: 'plane',
    label: 'Mặt phẳng (P)',
    shortLabel: 'Mặt phẳng',
    group: 'plane',
    description: 'Mặt phẳng (P) nghiêng không gian có tô mờ',
  },
  {
    id: 'crossSection',
    label: 'Thiết diện (Mặt cắt)',
    shortLabel: 'Thiết diện',
    group: 'plane',
    description: 'Đa giác thiết diện tô gạch chéo, thêm/kéo đỉnh tự do',
  },
];

const SPATIAL_SET = new Set<ShapeType>(SPATIAL_SHAPE_CATALOG.map((c) => c.id));

export function isSpatialShapeType(shapeType: ShapeType): shapeType is SpatialShapeKind {
  return SPATIAL_SET.has(shapeType);
}

function ptFromRatio(
  bx: number,
  by: number,
  bw: number,
  bh: number,
  rx: number,
  ry: number,
  label?: string
): ShapeVertex {
  const v: ShapeVertex = { x: bx + bw * rx, y: by + bh * ry };
  if (label) v.label = label;
  return v;
}

export function initSpatialShapeData(
  shapeType: SpatialShapeKind,
  x: number,
  y: number,
  width: number,
  height: number
): Pick<ShapeItem, 'vertices' | 'edges' | 'faces' | 'spatialMeta'> {
  const bx = width >= 0 ? x : x + width;
  const by = height >= 0 ? y : y + height;
  const bw = Math.max(8, Math.abs(width));
  const bh = Math.max(8, Math.abs(height));
  const P = (rx: number, ry: number, label?: string) =>
    ptFromRatio(bx, by, bw, bh, rx, ry, label);

  switch (shapeType) {
    case 'parallelogram':
      return {
        vertices: [P(0.24, 0.08, 'A'), P(0.96, 0.08, 'B'), P(0.76, 0.92, 'C'), P(0.04, 0.92, 'D')],
        edges: [
          { a: 0, b: 1 },
          { a: 1, b: 2 },
          { a: 2, b: 3 },
          { a: 3, b: 0 },
        ],
        faces: [[0, 1, 2, 3]],
        spatialMeta: { kind: 'parallelogram', showLabels: false },
      };

    case 'plane':
      return {
        vertices: [P(0.22, 0.14, 'A'), P(0.96, 0.14, 'B'), P(0.78, 0.88, 'C'), P(0.04, 0.88, 'D')],
        edges: [
          { a: 0, b: 1 },
          { a: 1, b: 2 },
          { a: 2, b: 3 },
          { a: 3, b: 0 },
        ],
        faces: [[0, 1, 2, 3]],
        spatialMeta: { kind: 'plane', showLabels: false, planeLabel: 'P' },
      };

    case 'crossSection':
      return {
        vertices: [P(0.26, 0.12, 'M'), P(0.84, 0.24, 'N'), P(0.92, 0.78, 'P'), P(0.10, 0.88, 'Q')],
        edges: [
          { a: 0, b: 1 },
          { a: 1, b: 2 },
          { a: 2, b: 3 },
          { a: 3, b: 0 },
        ],
        faces: [[0, 1, 2, 3]],
        spatialMeta: { kind: 'crossSection', showLabels: false },
      };

    case 'tetrahedron':
      return {
        vertices: [P(0.46, 0.06, 'S'), P(0.06, 0.74, 'A'), P(0.44, 0.94, 'B'), P(0.94, 0.70, 'C')],
        edges: [
          { a: 0, b: 1 },
          { a: 0, b: 2 },
          { a: 0, b: 3 },
          { a: 1, b: 2 },
          { a: 2, b: 3 },
          { a: 1, b: 3, hidden: true },
        ],
        faces: [
          [0, 1, 2],
          [0, 2, 3],
          [1, 2, 3],
        ],
        spatialMeta: { kind: 'tetrahedron', showLabels: false },
      };

    case 'pyramidSquare':
      return {
        vertices: [
          P(0.47, 0.06, 'S'),
          P(0.26, 0.62, 'A'),
          P(0.88, 0.62, 'B'),
          P(0.68, 0.94, 'C'),
          P(0.06, 0.94, 'D'),
        ],
        edges: [
          { a: 0, b: 1, hidden: true },
          { a: 0, b: 2 },
          { a: 0, b: 3 },
          { a: 0, b: 4 },
          { a: 1, b: 2, hidden: true },
          { a: 2, b: 3 },
          { a: 3, b: 4 },
          { a: 4, b: 1, hidden: true },
        ],
        faces: [
          [0, 4, 3],
          [0, 3, 2],
          [1, 2, 3, 4],
        ],
        spatialMeta: { kind: 'pyramidSquare', showLabels: false },
      };

    case 'pyramidConvex':
      return {
        vertices: [
          P(0.48, 0.06, 'S'),
          P(0.28, 0.58, 'A'),
          P(0.72, 0.56, 'B'),
          P(0.94, 0.76, 'C'),
          P(0.56, 0.95, 'D'),
          P(0.06, 0.80, 'E'),
        ],
        edges: [
          { a: 0, b: 1, hidden: true },
          { a: 0, b: 2, hidden: true },
          { a: 0, b: 3 },
          { a: 0, b: 4 },
          { a: 0, b: 5 },
          { a: 1, b: 2, hidden: true },
          { a: 2, b: 3, hidden: true },
          { a: 3, b: 4 },
          { a: 4, b: 5 },
          { a: 5, b: 1, hidden: true },
        ],
        faces: [
          [0, 5, 4],
          [0, 4, 3],
          [1, 2, 3, 4, 5],
        ],
        spatialMeta: { kind: 'pyramidConvex', showLabels: false },
      };

    case 'pyramidPerpEdge':
      return {
        vertices: [
          P(0.25, 0.06, 'S'),
          P(0.25, 0.62, 'A'),
          P(0.88, 0.62, 'B'),
          P(0.69, 0.94, 'C'),
          P(0.06, 0.94, 'D'),
        ],
        edges: [
          { a: 0, b: 1, hidden: true },
          { a: 0, b: 2 },
          { a: 0, b: 3 },
          { a: 0, b: 4 },
          { a: 1, b: 2, hidden: true },
          { a: 2, b: 3 },
          { a: 3, b: 4 },
          { a: 4, b: 1, hidden: true },
        ],
        faces: [
          [0, 4, 3],
          [0, 3, 2],
          [1, 2, 3, 4],
        ],
        spatialMeta: { kind: 'pyramidPerpEdge', showLabels: false },
      };

    case 'pyramidPerpFace':
      return {
        vertices: [
          P(0.42, 0.06, 'S'),
          P(0.26, 0.62, 'A'),
          P(0.88, 0.62, 'B'),
          P(0.68, 0.94, 'C'),
          P(0.06, 0.94, 'D'),
        ],
        edges: [
          { a: 0, b: 1, hidden: true },
          { a: 0, b: 2 },
          { a: 0, b: 3 },
          { a: 0, b: 4 },
          { a: 1, b: 2, hidden: true },
          { a: 2, b: 3 },
          { a: 3, b: 4 },
          { a: 4, b: 1, hidden: true },
        ],
        faces: [
          [0, 4, 3],
          [0, 3, 2],
          [1, 2, 3, 4],
        ],
        spatialMeta: { kind: 'pyramidPerpFace', showLabels: false },
      };

    case 'prismTriRight':
      return {
        vertices: [
          P(0.08, 0.72, 'A'),
          P(0.46, 0.94, 'B'),
          P(0.92, 0.72, 'C'),
          P(0.08, 0.08, "A'"),
          P(0.46, 0.30, "B'"),
          P(0.92, 0.08, "C'"),
        ],
        edges: [
          { a: 0, b: 1 },
          { a: 1, b: 2 },
          { a: 0, b: 2, hidden: true },
          { a: 3, b: 4 },
          { a: 4, b: 5 },
          { a: 5, b: 3 },
          { a: 0, b: 3 },
          { a: 1, b: 4 },
          { a: 2, b: 5 },
        ],
        faces: [
          [3, 4, 5],
          [0, 1, 4, 3],
          [1, 2, 5, 4],
        ],
        spatialMeta: { kind: 'prismTriRight', showLabels: false },
      };

    case 'prismOblique':
      return {
        vertices: [
          P(0.06, 0.74, 'A'),
          P(0.36, 0.94, 'B'),
          P(0.74, 0.74, 'C'),
          P(0.26, 0.08, "A'"),
          P(0.56, 0.28, "B'"),
          P(0.94, 0.08, "C'"),
        ],
        edges: [
          { a: 0, b: 1 },
          { a: 1, b: 2 },
          { a: 0, b: 2, hidden: true },
          { a: 3, b: 4 },
          { a: 4, b: 5 },
          { a: 5, b: 3 },
          { a: 0, b: 3 },
          { a: 1, b: 4 },
          { a: 2, b: 5 },
        ],
        faces: [
          [3, 4, 5],
          [0, 1, 4, 3],
          [1, 2, 5, 4],
        ],
        spatialMeta: { kind: 'prismOblique', showLabels: false },
      };

    case 'cuboid3d':
      return {
        vertices: [
          P(0.26, 0.68, 'A'),
          P(0.94, 0.68, 'B'),
          P(0.74, 0.94, 'C'),
          P(0.06, 0.94, 'D'),
          P(0.26, 0.06, "A'"),
          P(0.94, 0.06, "B'"),
          P(0.74, 0.32, "C'"),
          P(0.06, 0.32, "D'"),
        ],
        edges: [
          { a: 0, b: 1, hidden: true },
          { a: 1, b: 2 },
          { a: 2, b: 3 },
          { a: 3, b: 0, hidden: true },
          { a: 4, b: 5 },
          { a: 5, b: 6 },
          { a: 6, b: 7 },
          { a: 7, b: 4 },
          { a: 0, b: 4, hidden: true },
          { a: 1, b: 5 },
          { a: 2, b: 6 },
          { a: 3, b: 7 },
        ],
        faces: [
          [4, 5, 6, 7],
          [3, 2, 6, 7],
          [2, 1, 5, 6],
        ],
        spatialMeta: { kind: 'cuboid3d', showLabels: false },
      };

    case 'cylinder3d':
      return {
        vertices: [
          P(0.50, 0.16, "O'"),
          P(0.50, 0.84, 'O'),
          P(0.92, 0.84, 'R'),
          P(0.50, 0.96, 'F'),
        ],
        edges: [],
        faces: [],
        spatialMeta: { kind: 'cylinder3d', showLabels: false },
      };

    case 'cone3d':
      return {
        vertices: [
          P(0.50, 0.06, 'S'),
          P(0.50, 0.82, 'O'),
          P(0.92, 0.82, 'R'),
          P(0.50, 0.96, 'F'),
        ],
        edges: [],
        faces: [],
        spatialMeta: { kind: 'cone3d', showLabels: false },
      };

    case 'sphere3d':
      return {
        vertices: [P(0.50, 0.50, 'O'), P(0.95, 0.50, 'R'), P(0.50, 0.66, 'F')],
        edges: [],
        faces: [],
        spatialMeta: { kind: 'sphere3d', showLabels: false },
      };
  }
}

export function getEllipseBasisFromControl(
  center: { x: number; y: number },
  rim: { x: number; y: number },
  depth: { x: number; y: number }
): { rx: number; ry: number; rotRad: number; ux: number; uy: number; nx: number; ny: number } {
  const dx = rim.x - center.x;
  const dy = rim.y - center.y;
  const rx = Math.max(8, Math.hypot(dx, dy));
  const rotRad = Math.atan2(dy, dx);
  const ux = Math.cos(rotRad);
  const uy = Math.sin(rotRad);
  const nx = -uy;
  const ny = ux;
  const proj = (depth.x - center.x) * nx + (depth.y - center.y) * ny;
  const ry = Math.max(4, Math.min(rx * 0.92, Math.abs(proj) || rx * 0.3));
  return { rx, ry, rotRad, ux, uy, nx, ny };
}

export function computeShapeBBoxFromVertices(shape: ShapeItem): BBox {
  const verts = shape.vertices;
  if (!verts || verts.length === 0) {
    return {
      x: shape.width >= 0 ? shape.x : shape.x + shape.width,
      y: shape.height >= 0 ? shape.y : shape.y + shape.height,
      width: Math.abs(shape.width),
      height: Math.abs(shape.height),
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const expand = (px: number, py: number) => {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  };

  if (shape.shapeType === 'sphere3d' && verts.length >= 2) {
    const o = verts[0];
    const r = Math.max(8, dist(o, verts[1]));
    expand(o.x - r, o.y - r);
    expand(o.x + r, o.y + r);
  } else if (shape.shapeType === 'cylinder3d' && verts.length >= 4) {
    const [topC, botC, rim, front] = verts;
    const { rx, ry, ux, uy, nx, ny } = getEllipseBasisFromControl(botC, rim, front);
    const halfW = Math.hypot(rx * ux, ry * nx);
    const halfH = Math.hypot(rx * uy, ry * ny);
    expand(topC.x - halfW, topC.y - halfH);
    expand(topC.x + halfW, topC.y + halfH);
    expand(botC.x - halfW, botC.y - halfH);
    expand(botC.x + halfW, botC.y + halfH);
  } else if (shape.shapeType === 'cone3d' && verts.length >= 4) {
    const [apex, botC, rim, front] = verts;
    const { rx, ry, ux, uy, nx, ny } = getEllipseBasisFromControl(botC, rim, front);
    const halfW = Math.hypot(rx * ux, ry * nx);
    const halfH = Math.hypot(rx * uy, ry * ny);
    expand(apex.x, apex.y);
    expand(botC.x - halfW, botC.y - halfH);
    expand(botC.x + halfW, botC.y + halfH);
  } else {
    for (const v of verts) expand(v.x, v.y);
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(8, maxX - minX),
    height: Math.max(8, maxY - minY),
  };
}

export function withRecomputedSpatialBBox(shape: ShapeItem): ShapeItem {
  const b = computeShapeBBoxFromVertices(shape);
  return {
    ...shape,
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
  };
}

export function moveSpatialVertex(
  shape: ShapeItem,
  vertexIdx: number,
  nextPt: { x: number; y: number }
): ShapeItem {
  const verts = shape.vertices ? shape.vertices.map((v) => ({ ...v })) : [];
  if (vertexIdx < 0 || vertexIdx >= verts.length) return shape;

  if (shape.shapeType === 'sphere3d' && verts.length >= 3) {
    const oldO = verts[0];
    if (vertexIdx === 0) {
      const dx = nextPt.x - oldO.x;
      const dy = nextPt.y - oldO.y;
      verts[0] = { ...verts[0], x: nextPt.x, y: nextPt.y };
      verts[1] = { ...verts[1], x: verts[1].x + dx, y: verts[1].y + dy };
      verts[2] = { ...verts[2], x: verts[2].x + dx, y: verts[2].y + dy };
    } else if (vertexIdx === 1) {
      const oldR = Math.max(8, dist(oldO, verts[1]));
      const oldFlat = Math.max(0.15, Math.min(0.85, dist(oldO, verts[2]) / oldR));
      const newR = Math.max(12, dist(oldO, nextPt));
      const ang = Math.atan2(nextPt.y - oldO.y, nextPt.x - oldO.x);
      verts[1] = { ...verts[1], x: nextPt.x, y: nextPt.y };
      verts[2] = {
        ...verts[2],
        x: oldO.x - Math.sin(ang) * newR * oldFlat,
        y: oldO.y + Math.cos(ang) * newR * oldFlat,
      };
    } else if (vertexIdx === 2) {
      const basis = getEllipseBasisFromControl(oldO, verts[1], nextPt);
      const sign =
        (nextPt.x - oldO.x) * basis.nx + (nextPt.y - oldO.y) * basis.ny >= 0 ? 1 : -1;
      const clampedRy = Math.max(4, Math.min(basis.rx * 0.9, Math.abs((nextPt.x - oldO.x) * basis.nx + (nextPt.y - oldO.y) * basis.ny)));
      verts[2] = {
        ...verts[2],
        x: oldO.x + basis.nx * clampedRy * sign,
        y: oldO.y + basis.ny * clampedRy * sign,
      };
    }
    return withRecomputedSpatialBBox({ ...shape, vertices: verts });
  }

  if ((shape.shapeType === 'cylinder3d' || shape.shapeType === 'cone3d') && verts.length >= 4) {
    const oldBot = verts[1];
    if (vertexIdx === 1) {
      const dx = nextPt.x - oldBot.x;
      const dy = nextPt.y - oldBot.y;
      verts[1] = { ...verts[1], x: nextPt.x, y: nextPt.y };
      verts[2] = { ...verts[2], x: verts[2].x + dx, y: verts[2].y + dy };
      verts[3] = { ...verts[3], x: verts[3].x + dx, y: verts[3].y + dy };
    } else if (vertexIdx === 2) {
      const oldR = Math.max(8, dist(oldBot, verts[2]));
      const oldFlat = Math.max(0.15, Math.min(0.85, dist(oldBot, verts[3]) / oldR));
      const newR = Math.max(10, dist(oldBot, nextPt));
      const ang = Math.atan2(nextPt.y - oldBot.y, nextPt.x - oldBot.x);
      verts[2] = { ...verts[2], x: nextPt.x, y: nextPt.y };
      verts[3] = {
        ...verts[3],
        x: oldBot.x - Math.sin(ang) * newR * oldFlat,
        y: oldBot.y + Math.cos(ang) * newR * oldFlat,
      };
    } else if (vertexIdx === 3) {
      const basis = getEllipseBasisFromControl(oldBot, verts[2], nextPt);
      const proj = (nextPt.x - oldBot.x) * basis.nx + (nextPt.y - oldBot.y) * basis.ny;
      const sign = proj >= 0 ? 1 : -1;
      const clampedRy = Math.max(4, Math.min(basis.rx * 0.9, Math.abs(proj)));
      verts[3] = {
        ...verts[3],
        x: oldBot.x + basis.nx * clampedRy * sign,
        y: oldBot.y + basis.ny * clampedRy * sign,
      };
    } else {
      verts[vertexIdx] = { ...verts[vertexIdx], x: nextPt.x, y: nextPt.y };
    }
    return withRecomputedSpatialBBox({ ...shape, vertices: verts });
  }

  verts[vertexIdx] = { ...verts[vertexIdx], x: nextPt.x, y: nextPt.y };
  return withRecomputedSpatialBBox({ ...shape, vertices: verts });
}

export function addVertexToPolygonShape(shape: ShapeItem): ShapeItem {
  if (!shape.vertices || shape.vertices.length < 3 || shape.vertices.length >= 10) return shape;
  if (shape.shapeType !== 'crossSection' && shape.shapeType !== 'parallelogram' && shape.shapeType !== 'plane') {
    return shape;
  }
  const verts = shape.vertices;
  let longestIdx = 0;
  let longestLen = -1;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const d = dist(a, b);
    if (d > longestLen) {
      longestLen = d;
      longestIdx = i;
    }
  }
  const a = verts[longestIdx];
  const b = verts[(longestIdx + 1) % verts.length];
  const newVert: ShapeVertex = {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    label: String.fromCharCode(77 + (verts.length % 10)),
  };
  const nextVerts = [
    ...verts.slice(0, longestIdx + 1),
    newVert,
    ...verts.slice(longestIdx + 1),
  ];
  const nextEdges: ShapeEdge[] = nextVerts.map((_, i) => ({
    a: i,
    b: (i + 1) % nextVerts.length,
  }));
  const nextFaces = [nextVerts.map((_, i) => i)];
  return withRecomputedSpatialBBox({
    ...shape,
    vertices: nextVerts,
    edges: nextEdges,
    faces: nextFaces,
  });
}

export function removeVertexFromPolygonShape(shape: ShapeItem): ShapeItem {
  if (!shape.vertices || shape.vertices.length <= 3) return shape;
  if (shape.shapeType !== 'crossSection') return shape;
  const nextVerts = shape.vertices.slice(0, -1);
  const nextEdges: ShapeEdge[] = nextVerts.map((_, i) => ({
    a: i,
    b: (i + 1) % nextVerts.length,
  }));
  const nextFaces = [nextVerts.map((_, i) => i)];
  return withRecomputedSpatialBBox({
    ...shape,
    vertices: nextVerts,
    edges: nextEdges,
    faces: nextFaces,
  });
}

function lineIntersection(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number }
): { x: number; y: number } | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-5) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denom;
  return { x: a.x + t * rx, y: a.y + t * ry };
}

function projectPointOnLine(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-5) return { x: a.x, y: a.y };
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function drawRightAngleCorner(
  ctx: CanvasRenderingContext2D,
  corner: { x: number; y: number },
  towardA: { x: number; y: number },
  towardB: { x: number; y: number },
  size: number
) {
  const da = Math.hypot(towardA.x - corner.x, towardA.y - corner.y);
  const db = Math.hypot(towardB.x - corner.x, towardB.y - corner.y);
  if (da < 4 || db < 4) return;
  const s = Math.min(size, da * 0.45, db * 0.45);
  const uax = ((towardA.x - corner.x) / da) * s;
  const uay = ((towardA.y - corner.y) / da) * s;
  const ubx = ((towardB.x - corner.x) / db) * s;
  const uby = ((towardB.y - corner.y) / db) * s;

  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(corner.x + uax, corner.y + uay);
  ctx.lineTo(corner.x + uax + ubx, corner.y + uay + uby);
  ctx.lineTo(corner.x + ubx, corner.y + uby);
  ctx.stroke();
  ctx.restore();
}

function getConeTangentPoints(
  apex: { x: number; y: number },
  center: { x: number; y: number },
  rx: number,
  ry: number,
  rotRad: number
): [{ x: number; y: number }, { x: number; y: number }] {
  const cos = Math.cos(-rotRad);
  const sin = Math.sin(-rotRad);
  const dx = apex.x - center.x;
  const dy = apex.y - center.y;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;

  const ux = lx / rx;
  const uy = ly / ry;
  const d2 = ux * ux + uy * uy;

  let t1: { x: number; y: number };
  let t2: { x: number; y: number };

  if (d2 <= 1.02) {
    t1 = { x: -rx, y: 0 };
    t2 = { x: rx, y: 0 };
  } else {
    const k = 1 / d2;
    const m = Math.sqrt(d2 - 1) / d2;
    t1 = { x: (k * ux - m * uy) * rx, y: (k * uy + m * ux) * ry };
    t2 = { x: (k * ux + m * uy) * rx, y: (k * uy - m * ux) * ry };
  }

  const fcos = Math.cos(rotRad);
  const fsin = Math.sin(rotRad);
  const toWorld = (p: { x: number; y: number }) => ({
    x: center.x + p.x * fcos - p.y * fsin,
    y: center.y + p.x * fsin + p.y * fcos,
  });
  return [toWorld(t1), toWorld(t2)];
}

function applyEdgeDash(
  ctx: CanvasRenderingContext2D,
  style: StrokeStyle,
  strokeWidth: number,
  hidden: boolean
) {
  if (hidden) {
    const dash = Math.max(6, strokeWidth * 2.5);
    const gap = Math.max(4.5, strokeWidth * 1.9);
    ctx.setLineDash([dash, gap]);
    return;
  }
  if (style === 'dashed') {
    ctx.setLineDash([Math.max(8, strokeWidth * 3.1), Math.max(6, strokeWidth * 2.1)]);
  } else if (style === 'dotted') {
    ctx.lineCap = 'round';
    ctx.setLineDash([0.1, Math.max(5.5, strokeWidth * 2.2)]);
  } else {
    ctx.setLineDash([]);
  }
}

export function renderSpatialShape(ctx: CanvasRenderingContext2D, shape: ShapeItem) {
  const verts = shape.vertices;
  if (!verts || verts.length === 0) return;

  const sw = Math.max(1, shape.strokeWidth || 2.5);
  const userStyle: StrokeStyle = shape.lineStyle ?? (shape.dashed ? 'dashed' : 'solid');
  const hasExplicitFill =
    Boolean(shape.fillColor) && shape.fillColor !== 'transparent' && shape.fillOpacity > 0;

  ctx.save();
  ctx.strokeStyle = shape.strokeColor;
  ctx.lineWidth = sw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const showLabels = Boolean(shape.spatialMeta?.showLabels);

  const drawLabelText = (txt: string, px: number, py: number, ox = 8, oy = -8) => {
    ctx.save();
    ctx.setLineDash([]);
    ctx.font = `700 ${Math.max(13, Math.min(20, 12 + sw))}px "DM Sans", sans-serif`;
    ctx.fillStyle = shape.strokeColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(txt, px + ox, py + oy);
    ctx.restore();
  };

  // 1. Curved 3D Solids (Cylinder, Cone, Sphere)
  if (shape.shapeType === 'cylinder3d' && verts.length >= 4) {
    const [topC, botC, rim, front] = verts;
    const { rx, ry, rotRad, ux, uy } = getEllipseBasisFromControl(botC, rim, front);
    const tL = { x: topC.x - ux * rx, y: topC.y - uy * rx };
    const tR = { x: topC.x + ux * rx, y: topC.y + uy * rx };
    const bL = { x: botC.x - ux * rx, y: botC.y - uy * rx };
    const bR = { x: botC.x + ux * rx, y: botC.y + uy * rx };

    if (hasExplicitFill) {
      ctx.save();
      ctx.globalAlpha = shape.fillOpacity * 0.6;
      ctx.fillStyle = shape.fillColor;
      ctx.beginPath();
      ctx.ellipse(topC.x, topC.y, rx, ry, rotRad, Math.PI, Math.PI * 2);
      ctx.lineTo(bR.x, bR.y);
      ctx.ellipse(botC.x, botC.y, rx, ry, rotRad, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Back half of bottom ellipse (hidden)
    ctx.save();
    ctx.globalAlpha = 0.78;
    applyEdgeDash(ctx, userStyle, sw, true);
    ctx.beginPath();
    ctx.ellipse(botC.x, botC.y, rx, ry, rotRad, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Axis O'O and bottom radius OR (dashed construction lines)
    ctx.lineWidth = Math.max(1.1, sw * 0.72);
    ctx.beginPath();
    ctx.moveTo(topC.x, topC.y);
    ctx.lineTo(botC.x, botC.y);
    ctx.moveTo(botC.x, botC.y);
    ctx.lineTo(bR.x, bR.y);
    ctx.stroke();
    drawRightAngleCorner(ctx, botC, topC, bR, Math.min(13, sw * 4.2));
    ctx.restore();

    // Visible front half of bottom ellipse, full top ellipse, and vertical sides
    applyEdgeDash(ctx, userStyle, sw, false);
    ctx.beginPath();
    ctx.ellipse(topC.x, topC.y, rx, ry, rotRad, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(botC.x, botC.y, rx, ry, rotRad, 0, Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tL.x, tL.y);
    ctx.lineTo(bL.x, bL.y);
    ctx.moveTo(tR.x, tR.y);
    ctx.lineTo(bR.x, bR.y);
    ctx.stroke();

    // Small center dots
    ctx.fillStyle = shape.strokeColor;
    for (const c of [topC, botC]) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(2, sw * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }

    if (showLabels) {
      drawLabelText("O'", topC.x, topC.y, -12, -8);
      drawLabelText('O', botC.x, botC.y, -12, 10);
    }

    ctx.restore();
    return;
  }

  if (shape.shapeType === 'cone3d' && verts.length >= 4) {
    const [apex, botC, rim, front] = verts;
    const { rx, ry, rotRad, ux, uy } = getEllipseBasisFromControl(botC, rim, front);
    const [tanA, tanB] = getConeTangentPoints(apex, botC, rx, ry, rotRad);
    const bR = { x: botC.x + ux * rx, y: botC.y + uy * rx };

    if (hasExplicitFill) {
      ctx.save();
      ctx.globalAlpha = shape.fillOpacity * 0.65;
      ctx.fillStyle = shape.fillColor;
      ctx.beginPath();
      ctx.moveTo(apex.x, apex.y);
      ctx.lineTo(tanA.x, tanA.y);
      ctx.ellipse(botC.x, botC.y, rx, ry, rotRad, 0, Math.PI);
      ctx.lineTo(tanB.x, tanB.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Hidden back arc + SO altitude + OR radius
    ctx.save();
    ctx.globalAlpha = 0.78;
    applyEdgeDash(ctx, userStyle, sw, true);
    ctx.beginPath();
    ctx.ellipse(botC.x, botC.y, rx, ry, rotRad, Math.PI, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = Math.max(1.1, sw * 0.72);
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(botC.x, botC.y);
    ctx.moveTo(botC.x, botC.y);
    ctx.lineTo(bR.x, bR.y);
    ctx.stroke();
    drawRightAngleCorner(ctx, botC, apex, bR, Math.min(13, sw * 4.2));
    ctx.restore();

    // Visible front arc + 2 slant generators
    applyEdgeDash(ctx, userStyle, sw, false);
    ctx.beginPath();
    ctx.ellipse(botC.x, botC.y, rx, ry, rotRad, 0, Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(tanA.x, tanA.y);
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(tanB.x, tanB.y);
    ctx.stroke();

    ctx.fillStyle = shape.strokeColor;
    ctx.beginPath();
    ctx.arc(botC.x, botC.y, Math.max(2, sw * 0.8), 0, Math.PI * 2);
    ctx.fill();

    if (showLabels) {
      drawLabelText('S', apex.x, apex.y, 0, -14);
      drawLabelText('O', botC.x, botC.y, -12, 10);
    }

    ctx.restore();
    return;
  }

  if (shape.shapeType === 'sphere3d' && verts.length >= 3) {
    const [center, rim, front] = verts;
    const { rx: radius, ry, rotRad } = getEllipseBasisFromControl(center, rim, front);

    if (hasExplicitFill) {
      ctx.save();
      ctx.globalAlpha = shape.fillOpacity * 0.65;
      ctx.fillStyle = shape.fillColor;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Back half of equator (hidden dashed)
    ctx.save();
    ctx.globalAlpha = 0.78;
    applyEdgeDash(ctx, userStyle, sw, true);
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, radius, ry, rotRad, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Outer circle + front half of equator (solid)
    applyEdgeDash(ctx, userStyle, sw, false);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(center.x, center.y, radius, ry, rotRad, 0, Math.PI);
    ctx.stroke();

    // Subtle center dot O
    ctx.fillStyle = shape.strokeColor;
    ctx.beginPath();
    ctx.arc(center.x, center.y, Math.max(2.2, sw * 0.85), 0, Math.PI * 2);
    ctx.fill();

    if (showLabels) {
      drawLabelText('O', center.x, center.y, -12, -10);
    }

    ctx.restore();
    return;
  }

  // 2. Polyhedra, Plane, Parallelogram & Cross-Section
  const faces = shape.faces || [];
  if (hasExplicitFill && faces.length > 0) {
    for (const face of faces) {
      if (face.length < 3) continue;
      ctx.save();
      ctx.globalAlpha = shape.fillOpacity * 0.55;
      ctx.fillStyle = shape.fillColor;
      ctx.beginPath();
      ctx.moveTo(verts[face[0]].x, verts[face[0]].y);
      for (let i = 1; i < face.length; i++) {
        const v = verts[face[i]];
        if (v) ctx.lineTo(v.x, v.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else if (shape.shapeType === 'plane' && verts.length >= 3) {
    // Subtle translucent plane tint even when no fill color is picked
    ctx.save();
    ctx.fillStyle = shape.strokeColor;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (shape.shapeType === 'crossSection' && verts.length >= 3) {
    // Subtle cross-section tint even without explicit fill
    ctx.save();
    ctx.fillStyle = shape.strokeColor;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Diagonal hatch pattern inside crossSection (Thiết diện)
  if (shape.shapeType === 'crossSection' && verts.length >= 3) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
    ctx.clip();

    const bbox = computeShapeBBoxFromVertices(shape);
    const step = Math.max(10, sw * 4.5);
    ctx.strokeStyle = hasExplicitFill ? shape.fillColor : shape.strokeColor;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = Math.max(1, sw * 0.55);
    ctx.setLineDash([]);
    ctx.beginPath();
    for (let d = -bbox.height; d <= bbox.width + bbox.height; d += step) {
      ctx.moveTo(bbox.x + d, bbox.y);
      ctx.lineTo(bbox.x + d - bbox.height, bbox.y + bbox.height);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Draw edges (hidden edges dashed first, then visible solid/styled edges on top)
  const edges = shape.edges || [];
  for (const passHidden of [true, false]) {
    for (const edge of edges) {
      const isHidden = Boolean(edge.hidden);
      if (isHidden !== passHidden) continue;
      const a = verts[edge.a];
      const b = verts[edge.b];
      if (!a || !b) continue;
      ctx.save();
      if (isHidden) ctx.globalAlpha = 0.78;
      applyEdgeDash(ctx, userStyle, sw, isHidden);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Special textbook geometric constructions (Altitudes, Diagonals, Right-Angle markers, Plane label)
  if (shape.shapeType === 'pyramidSquare' && verts.length >= 5) {
    const [S, A, B, C, D] = verts;
    const O =
      lineIntersection(A, C, B, D) || {
        x: (A.x + B.x + C.x + D.x) / 4,
        y: (A.y + B.y + C.y + D.y) / 4,
      };
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = Math.max(1.1, sw * 0.72);
    applyEdgeDash(ctx, userStyle, sw, true);
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(C.x, C.y);
    ctx.moveTo(B.x, B.y);
    ctx.lineTo(D.x, D.y);
    ctx.moveTo(S.x, S.y);
    ctx.lineTo(O.x, O.y);
    ctx.stroke();
    drawRightAngleCorner(ctx, O, S, C, Math.min(13, sw * 4.2));
    ctx.fillStyle = shape.strokeColor;
    ctx.beginPath();
    ctx.arc(O.x, O.y, Math.max(2, sw * 0.75), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (showLabels) {
      drawLabelText('O', O.x, O.y, 12, 10);
    }
  } else if (shape.shapeType === 'pyramidPerpEdge' && verts.length >= 5) {
    const [S, A, B, , D] = verts;
    ctx.save();
    ctx.lineWidth = Math.max(1.1, sw * 0.72);
    ctx.globalAlpha = 0.85;
    drawRightAngleCorner(ctx, A, S, B, Math.min(14, sw * 4.5));
    drawRightAngleCorner(ctx, A, S, D, Math.min(12, sw * 4.0));
    ctx.restore();
  } else if (shape.shapeType === 'pyramidPerpFace' && verts.length >= 5) {
    const [S, A, B] = verts;
    const H = projectPointOnLine(S, A, B);
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = Math.max(1.1, sw * 0.72);
    applyEdgeDash(ctx, userStyle, sw, true);
    ctx.beginPath();
    ctx.moveTo(S.x, S.y);
    ctx.lineTo(H.x, H.y);
    ctx.stroke();
    drawRightAngleCorner(ctx, H, S, B, Math.min(13, sw * 4.2));
    ctx.fillStyle = shape.strokeColor;
    ctx.beginPath();
    ctx.arc(H.x, H.y, Math.max(2, sw * 0.75), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (showLabels) {
      drawLabelText('H', H.x, H.y, -11, 11);
    }
  } else if (shape.shapeType === 'plane' && verts.length >= 4) {
    // Draw standard corner arc & "(P)" label at corner D (bottom-left)
    const D = verts[3];
    const C = verts[2];
    const A = verts[0];
    const angDC = Math.atan2(C.y - D.y, C.x - D.x);
    const angDA = Math.atan2(A.y - D.y, A.x - D.x);
    const arcR = Math.max(18, Math.min(34, dist(D, C) * 0.22, dist(D, A) * 0.28));
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(1.1, sw * 0.7);
    ctx.beginPath();
    // Draw shortest arc between angDA and angDC
    let diff = angDC - angDA;
    while (diff <= -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    ctx.arc(D.x, D.y, arcR, angDA, angDA + diff, diff < 0);
    ctx.stroke();

    const midAng = angDA + diff * 0.52;
    const lx = D.x + Math.cos(midAng) * (arcR + 12);
    const ly = D.y + Math.sin(midAng) * (arcR + 10);
    ctx.font = `italic 600 ${Math.max(13, Math.min(18, 12 + sw))}px "DM Sans", sans-serif`;
    ctx.fillStyle = shape.strokeColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(shape.spatialMeta?.planeLabel ? `(${shape.spatialMeta.planeLabel})` : '(P)', lx, ly);
    ctx.restore();
  }

  // Optional vertex labels
  if (showLabels) {
    const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length;
    const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length;
    for (const v of verts) {
      if (!v.label) continue;
      const dx = v.x - cx;
      const dy = v.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      drawLabelText(v.label, v.x, v.y, (dx / d) * 14, (dy / d) * 14);
    }
  }

  ctx.restore();
}

export function hitTestSpatialShape(
  shape: ShapeItem,
  pt: { x: number; y: number },
  tolerance: number
): boolean {
  const verts = shape.vertices;
  if (!verts || verts.length === 0) return false;

  for (const v of verts) {
    if (dist(pt, v) <= tolerance + 5) return true;
  }

  if (shape.shapeType === 'sphere3d' && verts.length >= 2) {
    const r = Math.max(8, dist(verts[0], verts[1]));
    return dist(pt, verts[0]) <= r + tolerance;
  }

  if ((shape.shapeType === 'cylinder3d' || shape.shapeType === 'cone3d') && verts.length >= 4) {
    const b = computeShapeBBoxFromVertices(shape);
    return (
      pt.x >= b.x - tolerance &&
      pt.x <= b.x + b.width + tolerance &&
      pt.y >= b.y - tolerance &&
      pt.y <= b.y + b.height + tolerance
    );
  }

  const edges = shape.edges || [];
  for (const edge of edges) {
    const a = verts[edge.a];
    const b = verts[edge.b];
    if (a && b && distToSegment(pt, a, b).distance <= tolerance + 4) {
      return true;
    }
  }

  if (shape.faces) {
    for (const face of shape.faces) {
      const poly = face.map((idx) => verts[idx]).filter(Boolean);
      if (poly.length >= 3 && pointInPolygon(pt, poly)) {
        return true;
      }
    }
  }

  return false;
}

export function renderSpatialShapeToSvg(el: ShapeItem): string {
  const verts = el.vertices;
  if (!verts || verts.length === 0) return '';
  const sw = Math.max(1, el.strokeWidth || 2.5);
  const stroke = el.strokeColor;
  const fillAttr =
    el.fillColor && el.fillColor !== 'transparent' && el.fillOpacity > 0
      ? `fill="${el.fillColor}" fill-opacity="${el.fillOpacity * 0.6}"`
      : 'fill="none"';

  if (el.shapeType === 'sphere3d' && verts.length >= 3) {
    const [center, rim, front] = verts;
    const { rx, ry } = getEllipseBasisFromControl(center, rim, front);
    return [
      `<circle cx="${center.x}" cy="${center.y}" r="${rx}" stroke="${stroke}" stroke-width="${sw}" ${fillAttr} />`,
      `<ellipse cx="${center.x}" cy="${center.y}" rx="${rx}" ry="${ry}" stroke="${stroke}" stroke-width="${sw}" fill="none" stroke-dasharray="6,5" />`,
    ].join('\n');
  }

  if (el.shapeType === 'cylinder3d' && verts.length >= 4) {
    const [topC, botC, rim, front] = verts;
    const { rx, ry, ux, uy } = getEllipseBasisFromControl(botC, rim, front);
    return [
      `<ellipse cx="${topC.x}" cy="${topC.y}" rx="${rx}" ry="${ry}" stroke="${stroke}" stroke-width="${sw}" ${fillAttr} />`,
      `<ellipse cx="${botC.x}" cy="${botC.y}" rx="${rx}" ry="${ry}" stroke="${stroke}" stroke-width="${sw}" fill="none" stroke-dasharray="6,5" />`,
      `<line x1="${topC.x - ux * rx}" y1="${topC.y - uy * rx}" x2="${botC.x - ux * rx}" y2="${botC.y - uy * rx}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" />`,
      `<line x1="${topC.x + ux * rx}" y1="${topC.y + uy * rx}" x2="${botC.x + ux * rx}" y2="${botC.y + uy * rx}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" />`,
    ].join('\n');
  }

  if (el.shapeType === 'cone3d' && verts.length >= 4) {
    const [apex, botC, rim, front] = verts;
    const { rx, ry, rotRad } = getEllipseBasisFromControl(botC, rim, front);
    const [tanA, tanB] = getConeTangentPoints(apex, botC, rx, ry, rotRad);
    return [
      `<ellipse cx="${botC.x}" cy="${botC.y}" rx="${rx}" ry="${ry}" stroke="${stroke}" stroke-width="${sw}" fill="none" stroke-dasharray="6,5" />`,
      `<line x1="${apex.x}" y1="${apex.y}" x2="${tanA.x}" y2="${tanA.y}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" />`,
      `<line x1="${apex.x}" y1="${apex.y}" x2="${tanB.x}" y2="${tanB.y}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" />`,
    ].join('\n');
  }

  const lines: string[] = [];
  for (const edge of el.edges || []) {
    const a = verts[edge.a];
    const b = verts[edge.b];
    if (!a || !b) continue;
    const dash = edge.hidden ? 'stroke-dasharray="7,5" stroke-opacity="0.78"' : '';
    lines.push(
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" ${dash} />`
    );
  }
  return lines.join('\n');
}

export type ToolType =
  | 'select'
  | 'pen'
  | 'pencil'
  | 'highlighter'
  | 'eraser'
  | 'shape'
  | 'text'
  | 'sticky'
  | 'laser'
  | 'pan';

export type SelectMode = 'lasso' | 'box';
export type EraserMode = 'stroke' | 'partial';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export type ShapeType =
  | 'line'
  | 'arrow'
  | 'doubleArrow'
  | 'rect'
  | 'roundedRect'
  | 'ellipse'
  | 'triangle'
  | 'rightTriangle'
  | 'diamond'
  | 'star'
  | 'axes'
  | 'table';

export type PaperTemplate =
  | 'blank'
  | 'ivory'
  | 'greenboard'
  | 'greenboard_grid'
  | 'chalkboard'
  | 'ruled'
  | 'grid'
  | 'dots'
  | 'music';

export type PageSizeMode = 'infinite' | 'slide16x9' | 'a4Portrait' | 'a4Landscape';

export interface Point {
  x: number;
  y: number;
  pressure: number;
  t?: number;
}

export interface StrokeItem {
  id: string;
  type: 'stroke';
  tool: 'pen' | 'pencil' | 'highlighter';
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  lineStyle?: StrokeStyle;
  zIndex?: number;
}

export interface ShapeItem {
  id: string;
  type: 'shape';
  shapeType: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  strokeColor: string;
  fillColor: string;
  fillOpacity: number;
  strokeWidth: number;
  dashed?: boolean;
  lineStyle?: StrokeStyle;
  rows?: number;
  cols?: number;
}

export interface TextItem {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  bgColor: string;
}

export interface StickyItem {
  id: string;
  type: 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text: string;
  noteColor: string;
  textColor: string;
  fontSize: number;
}

export interface ImageItem {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  src: string;
  opacity: number;
  locked?: boolean;
}

export type BoardElement =
  | StrokeItem
  | ShapeItem
  | TextItem
  | StickyItem
  | ImageItem;

export interface BoardPage {
  id: string;
  title: string;
  template: PaperTemplate;
  pageSize: PageSizeMode;
  gridSize: number;
  elements: BoardElement[];
}

export interface NotebookDocument {
  id: string;
  ownerId?: string;
  slug?: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  activePageId: string;
  pages: BoardPage[];
  version: number;
}

export interface WebBoardMeta {
  slug: string;
  title: string;
  pageCount: number;
  updatedAt: number;
  createdAt: number;
}

export interface PenSlot {
  id: string;
  label: string;
  tool: 'pen' | 'pencil' | 'highlighter';
  color: string;
  width: number;
  opacity: number;
  lineStyle?: StrokeStyle;
}

export interface RulerState {
  visible: boolean;
  x: number;
  y: number;
  angleDeg: number;
  length: number;
}

export interface ViewportState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PAGE_DIMENSIONS: Record<Exclude<PageSizeMode, 'infinite'>, { width: number; height: number; label: string }> = {
  slide16x9: { width: 1600, height: 900, label: 'Trình chiếu 16:9' },
  a4Portrait: { width: 1120, height: 1584, label: 'Khổ A4 Dọc' },
  a4Landscape: { width: 1584, height: 1120, label: 'Khổ A4 Ngang' },
};

export const PAPER_TEMPLATES: {
  id: PaperTemplate;
  label: string;
  bg: string;
  line: string;
  dark: boolean;
}[] = [
  { id: 'blank', label: 'Bảng trắng', bg: '#FFFFFF', line: '#E2E8F0', dark: false },
  { id: 'ivory', label: 'Giấy kem', bg: '#FAF7F0', line: '#E6DFD1', dark: false },
  { id: 'greenboard', label: 'Xanh RAL', bg: '#274C43', line: 'rgba(255, 255, 255, 0.14)', dark: true },
  { id: 'greenboard_grid', label: 'Xanh 2 cột', bg: '#274C43', line: 'rgba(255, 255, 255, 0.14)', dark: true },
  { id: 'chalkboard', label: 'Bảng đen', bg: '#1B2027', line: 'rgba(226, 232, 240, 0.15)', dark: true },
  { id: 'ruled', label: 'Kẻ ngang', bg: '#FFFFFF', line: '#CBD5E1', dark: false },
  { id: 'grid', label: 'Ô vuông', bg: '#FFFFFF', line: '#CBD5E1', dark: false },
  { id: 'dots', label: 'Chấm bi', bg: '#FFFFFF', line: '#94A3B8', dark: false },
  { id: 'music', label: 'Khuông nhạc', bg: '#FFFFFF', line: '#94A3B8', dark: false },
];

export const DEFAULT_PEN_SLOTS: PenSlot[] = [
  { id: 'slot-1', label: 'Mực đen', tool: 'pen', color: '#0F172A', width: 3, opacity: 1 },
  { id: 'slot-2', label: 'Mực xanh', tool: 'pen', color: '#2563EB', width: 3, opacity: 1 },
  { id: 'slot-3', label: 'Mực đỏ', tool: 'pen', color: '#DC2626', width: 3.5, opacity: 1 },
  { id: 'slot-4', label: 'Bút chì', tool: 'pencil', color: '#334155', width: 2.5, opacity: 0.85 },
  { id: 'slot-5', label: 'Dạ quang vàng', tool: 'highlighter', color: '#FACC15', width: 22, opacity: 0.42 },
  { id: 'slot-6', label: 'Dạ quang hồng', tool: 'highlighter', color: '#F472B6', width: 22, opacity: 0.42 },
];

export const DEFAULT_CHALK_SLOTS: PenSlot[] = [
  { id: 'slot-1', label: 'Phấn vàng', tool: 'pen', color: '#FDE047', width: 3, opacity: 0.98 },
  { id: 'slot-2', label: 'Phấn trắng', tool: 'pen', color: '#FFFFFF', width: 2.8, opacity: 0.98 },
  { id: 'slot-3', label: 'Phấn hồng', tool: 'pencil', color: '#F9A8D4', width: 3.5, opacity: 0.95 },
  { id: 'slot-4', label: 'Phấn xanh lơ', tool: 'pencil', color: '#7DD3FC', width: 3.5, opacity: 0.95 },
  { id: 'slot-5', label: 'Phấn cam', tool: 'pen', color: '#FDBA74', width: 3, opacity: 0.95 },
  { id: 'slot-6', label: 'Dạ quang xanh', tool: 'highlighter', color: '#4ADE80', width: 22, opacity: 0.35 },
];

export const STICKY_COLORS = [
  { name: 'Vàng nắng', bg: '#FEF08A', text: '#422006' },
  { name: 'Xanh bạc hà', bg: '#BBF7D0', text: '#052E16' },
  { name: 'Xanh da trời', bg: '#BAE6FD', text: '#0C4A6E' },
  { name: 'Hồng phấn', bg: '#FBCFE8', text: '#500724' },
  { name: 'Tím oải hương', bg: '#DDD6FE', text: '#2E1065' },
];

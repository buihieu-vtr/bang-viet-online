export type PptxTransitionType =
  | 'none'
  | 'cut'
  | 'fade'
  | 'push'
  | 'wipe'
  | 'cover'
  | 'uncover'
  | 'split'
  | 'zoom'
  | 'dissolve'
  | 'blinds'
  | 'checker'
  | 'circle'
  | 'diamond'
  | 'wheel'
  | 'morph';

export type PptxDirection =
  | 'l'
  | 'r'
  | 'u'
  | 'd'
  | 'lu'
  | 'ru'
  | 'ld'
  | 'rd'
  | 'horz'
  | 'vert'
  | 'in'
  | 'out';

export interface PptxTransition {
  type: PptxTransitionType;
  direction?: PptxDirection;
  durationMs: number;
  advanceOnClick: boolean;
  advanceAfterMs?: number;
}

export type PptxAnimClass = 'entr' | 'exit' | 'emph' | 'path';

export type PptxAnimEffectName =
  | 'appear'
  | 'fade'
  | 'fly'
  | 'float'
  | 'wipe'
  | 'split'
  | 'zoom'
  | 'bounce'
  | 'swivel'
  | 'wheel'
  | 'blinds'
  | 'box'
  | 'diamond'
  | 'circle'
  | 'spin'
  | 'growShrink'
  | 'pulse'
  | 'teeter'
  | 'path';

export interface PptxAnimationEffect {
  id: string;
  targetShapeId: string;
  paragraphStart?: number;
  paragraphEnd?: number;
  animClass: PptxAnimClass;
  presetId: number;
  effectName: PptxAnimEffectName;
  direction?: PptxDirection;
  durationMs: number;
  delayMs: number;
  trigger: 'onClick' | 'withPrevious' | 'afterPrevious';
  motionPath?: string; // normalized 0..1 viewbox path or relative deltas
  scaleX?: number;
  scaleY?: number;
  rotateDeg?: number;
}

export interface PptxAnimationStep {
  id: string;
  effects: PptxAnimationEffect[];
}

export type PptxFill =
  | { type: 'none' }
  | { type: 'solid'; color: string }
  | {
      type: 'gradient';
      angleDeg: number;
      kind: 'linear' | 'radial';
      stops: { pos: number; color: string }[];
    }
  | { type: 'image'; src: string; mode?: 'stretch' | 'tile' };

export interface PptxStroke {
  color: string;
  width: number;
  dash?: 'solid' | 'dash' | 'dot' | 'dashDot';
  headEnd?: 'none' | 'arrow' | 'triangle' | 'stealth' | 'oval' | 'diamond';
  tailEnd?: 'none' | 'arrow' | 'triangle' | 'stealth' | 'oval' | 'diamond';
}

export interface PptxShadow {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface PptxRun {
  text: string;
  fontFamily?: string;
  fontSizePx: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  baseline?: number; // superscript > 0, subscript < 0
}

export interface PptxParagraph {
  align: 'left' | 'center' | 'right' | 'justify';
  level: number;
  marginLeftPx?: number;
  indentPx?: number;
  spaceBeforePx?: number;
  spaceAfterPx?: number;
  lineHeight?: number;
  bulletChar?: string;
  bulletColor?: string;
  runs: PptxRun[];
}

export interface PptxBaseElement {
  id: string;
  shapeId: string; // cNvPr @id used by p:timing spTgt
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipH?: boolean;
  flipV?: boolean;
  opacity?: number;
}

export interface PptxShapeElement extends PptxBaseElement {
  kind: 'shape';
  presetGeom: string;
  customPathD?: string;
  customPathW?: number;
  customPathH?: number;
  fill: PptxFill;
  stroke?: PptxStroke;
  shadow?: PptxShadow;
  paragraphs: PptxParagraph[];
  verticalAlign: 'top' | 'middle' | 'bottom';
  insets: { l: number; t: number; r: number; b: number };
  wordWrap: boolean;
  adj?: number[]; // adjustment values (e.g. roundRect radius)
}

export interface PptxImageElement extends PptxBaseElement {
  kind: 'image';
  src: string;
  crop?: { l: number; t: number; r: number; b: number }; // 0..1 fractions
  clipGeom?: string;
  stroke?: PptxStroke;
  shadow?: PptxShadow;
}

export interface PptxTableCell {
  fill: PptxFill;
  paragraphs: PptxParagraph[];
  verticalAlign: 'top' | 'middle' | 'bottom';
  gridSpan?: number;
  rowSpan?: number;
  hMerge?: boolean;
  vMerge?: boolean;
  borders?: {
    top?: PptxStroke;
    right?: PptxStroke;
    bottom?: PptxStroke;
    left?: PptxStroke;
  };
}

export interface PptxTableElement extends PptxBaseElement {
  kind: 'table';
  colWidths: number[];
  rowHeights: number[];
  rows: PptxTableCell[][];
}

export interface PptxChartSeries {
  name: string;
  color: string;
  values: number[];
}

export interface PptxChartElement extends PptxBaseElement {
  kind: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  title?: string;
  categories: string[];
  series: PptxChartSeries[];
  showLegend: boolean;
}

export type PptxElement =
  | PptxShapeElement
  | PptxImageElement
  | PptxTableElement
  | PptxChartElement;

export interface PptxSlide {
  id: string;
  pageId: string; // matches BoardPage.id
  slideNumber: number;
  title: string;
  background: PptxFill;
  elements: PptxElement[];
  transition: PptxTransition;
  autoEffects: PptxAnimationEffect[]; // effects triggered automatically on slide enter
  clickSteps: PptxAnimationStep[];
  notes?: string;
}

export interface PptxDeck {
  notebookId: string;
  title: string;
  width: number;
  height: number;
  slides: PptxSlide[];
}

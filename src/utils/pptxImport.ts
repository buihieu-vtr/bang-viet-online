import JSZip from 'jszip';
import { BoardPage, ImageItem, PAGE_DIMENSIONS } from '../types/inkboard';
import {
  PptxAnimClass,
  PptxAnimEffectName,
  PptxAnimationEffect,
  PptxAnimationStep,
  PptxChartElement,
  PptxChartSeries,
  PptxDeck,
  PptxDirection,
  PptxElement,
  PptxFill,
  PptxImageElement,
  PptxParagraph,
  PptxRun,
  PptxShadow,
  PptxShapeElement,
  PptxSlide,
  PptxStroke,
  PptxTableCell,
  PptxTableElement,
  PptxTransition,
  PptxTransitionType,
} from '../types/pptx';
import { uid } from './geometry';

export interface LoadedPptxInfo {
  fileName: string;
  fileSize: number;
  title: string;
  deck: PptxDeck;
  slideCount: number;
  transitionCount: number;
  animationCount: number;
}

export type PptxImportMode = 'newNotebook' | 'appendPages';

const PRESET_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  green: '#008000',
  blue: '#0000FF',
  yellow: '#FFFF00',
  cyan: '#00FFFF',
  magenta: '#FF00FF',
  gray: '#808080',
  grey: '#808080',
  dkGray: '#404040',
  ltGray: '#C0C0C0',
  orange: '#FFA500',
  pink: '#FFC0CB',
  purple: '#800080',
  navy: '#000080',
  teal: '#008080',
  silver: '#C0C0C0',
  maroon: '#800000',
  olive: '#808000',
  lime: '#00FF00',
};

const DEFAULT_THEME_COLORS: Record<string, string> = {
  dk1: '#000000',
  lt1: '#FFFFFF',
  dk2: '#1F497D',
  lt2: '#EEECE1',
  accent1: '#4F81BD',
  accent2: '#C0504D',
  accent3: '#9BBB59',
  accent4: '#8064A2',
  accent5: '#4BACC6',
  accent6: '#F79646',
  hlink: '#0000FF',
  folHlink: '#800080',
  tx1: '#000000',
  tx2: '#1F497D',
  bg1: '#FFFFFF',
  bg2: '#EEECE1',
};

const DEFAULT_CHART_PALETTE = [
  '#2563EB',
  '#EA580C',
  '#16A34A',
  '#9333EA',
  '#0891B2',
  '#E11D48',
  '#CA8A04',
];

function localName(el: Element): string {
  return el.localName || el.nodeName.split(':').pop() || '';
}

function childByName(parent: Element | null | undefined, name: string): Element | null {
  if (!parent) return null;
  for (let i = 0; i < parent.children.length; i++) {
    const ch = parent.children[i];
    const ln = localName(ch);
    if (ln === name) return ch;
    if (ln === 'AlternateContent') {
      const choice = childByName(ch, 'Choice');
      const foundChoice = childByName(choice, name);
      if (foundChoice) return foundChoice;
      const fallback = childByName(ch, 'Fallback');
      const foundFallback = childByName(fallback, name);
      if (foundFallback) return foundFallback;
    }
  }
  return null;
}

function childrenByName(parent: Element | null | undefined, name: string): Element[] {
  const out: Element[] = [];
  if (!parent) return out;
  for (let i = 0; i < parent.children.length; i++) {
    const ch = parent.children[i];
    const ln = localName(ch);
    if (ln === name) {
      out.push(ch);
    } else if (ln === 'AlternateContent') {
      const choice = childByName(ch, 'Choice');
      const list = childrenByName(choice, name);
      if (list.length > 0) out.push(...list);
      else {
        const fallback = childByName(ch, 'Fallback');
        out.push(...childrenByName(fallback, name));
      }
    }
  }
  return out;
}

function findDescendants(root: Element | null | undefined, name: string): Element[] {
  const out: Element[] = [];
  if (!root) return out;
  const walk = (node: Element) => {
    for (let i = 0; i < node.children.length; i++) {
      const ch = node.children[i];
      const ln = localName(ch);
      if (ln === 'AlternateContent') {
        const choice = childByName(ch, 'Choice');
        if (choice) walk(choice);
        else {
          const fb = childByName(ch, 'Fallback');
          if (fb) walk(fb);
        }
        continue;
      }
      if (ln === name) out.push(ch);
      walk(ch);
    }
  };
  walk(root);
  return out;
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

function normalizeZipPath(baseDir: string, target: string): string {
  const cleanTarget = target.replace(/\\/g, '/');
  if (cleanTarget.startsWith('/')) return cleanTarget.slice(1);
  const stack = baseDir ? baseDir.split('/').filter(Boolean) : [];
  for (const part of cleanTarget.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

async function readRels(zip: JSZip, partPath: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const lastSlash = partPath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? partPath.slice(0, lastSlash) : '';
  const fileName = lastSlash >= 0 ? partPath.slice(lastSlash + 1) : partPath;
  const relsPath = dir ? `${dir}/_rels/${fileName}.rels` : `_rels/${fileName}.rels`;
  const entry = zip.file(relsPath);
  if (!entry) return map;
  const xml = await entry.async('text');
  const doc = parseXml(xml);
  const rels = findDescendants(doc.documentElement, 'Relationship');
  for (const r of rels) {
    const id = r.getAttribute('Id') || '';
    const target = r.getAttribute('Target') || '';
    const targetMode = r.getAttribute('TargetMode') || '';
    if (!id || !target || targetMode === 'External') continue;
    map.set(id, normalizeZipPath(dir, target));
  }
  return map;
}

async function readRelsWithTypes(
  zip: JSZip,
  partPath: string
): Promise<{ id: string; target: string; type: string }[]> {
  const out: { id: string; target: string; type: string }[] = [];
  const lastSlash = partPath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? partPath.slice(0, lastSlash) : '';
  const fileName = lastSlash >= 0 ? partPath.slice(lastSlash + 1) : partPath;
  const relsPath = dir ? `${dir}/_rels/${fileName}.rels` : `_rels/${fileName}.rels`;
  const entry = zip.file(relsPath);
  if (!entry) return out;
  const xml = await entry.async('text');
  const doc = parseXml(xml);
  const rels = findDescendants(doc.documentElement, 'Relationship');
  for (const r of rels) {
    const id = r.getAttribute('Id') || '';
    const target = r.getAttribute('Target') || '';
    const type = r.getAttribute('Type') || '';
    const targetMode = r.getAttribute('TargetMode') || '';
    if (!id || !target || targetMode === 'External') continue;
    out.push({ id, target: normalizeZipPath(dir, target), type });
  }
  return out;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

interface ColorContext {
  themeColors: Record<string, string>;
  clrMap: Record<string, string>;
  themeFontMajor: string;
  themeFontMinor: string;
}

function resolveColorNode(
  colorEl: Element | null | undefined,
  ctx: ColorContext,
  phColor?: string
): string | null {
  if (!colorEl) return null;
  let baseHex: string | null = null;
  let colorNode: Element | null = null;

  for (let i = 0; i < colorEl.children.length; i++) {
    const ch = colorEl.children[i];
    const ln = localName(ch);
    if (ln === 'srgbClr') {
      baseHex = `#${ch.getAttribute('val') || '000000'}`;
      colorNode = ch;
      break;
    }
    if (ln === 'prstClr') {
      const val = ch.getAttribute('val') || 'black';
      baseHex = PRESET_COLORS[val] || '#000000';
      colorNode = ch;
      break;
    }
    if (ln === 'schemeClr') {
      const rawKey = ch.getAttribute('val') || 'tx1';
      if (rawKey === 'phClr' && phColor) {
        baseHex = phColor;
      } else {
        const mapped = ctx.clrMap[rawKey] || rawKey;
        baseHex = ctx.themeColors[mapped] || ctx.themeColors[rawKey] || DEFAULT_THEME_COLORS[mapped] || '#000000';
      }
      colorNode = ch;
      break;
    }
    if (ln === 'sysClr') {
      const lastClr = ch.getAttribute('lastClr');
      baseHex = lastClr ? `#${lastClr}` : '#000000';
      colorNode = ch;
      break;
    }
  }

  if (!baseHex) return null;

  let { r, g, b } = hexToRgb(baseHex);
  let alpha = 1;

  if (colorNode) {
    for (let i = 0; i < colorNode.children.length; i++) {
      const mod = colorNode.children[i];
      const mln = localName(mod);
      const val = Number(mod.getAttribute('val') || 0) / 100000;
      if (mln === 'alpha') {
        alpha = Math.max(0, Math.min(1, val));
      } else if (mln === 'tint') {
        r = Math.round(r * val + 255 * (1 - val));
        g = Math.round(g * val + 255 * (1 - val));
        b = Math.round(b * val + 255 * (1 - val));
      } else if (mln === 'shade') {
        r = Math.round(r * val);
        g = Math.round(g * val);
        b = Math.round(b * val);
      } else if (mln === 'lumMod') {
        const hsl = rgbToHsl(r, g, b);
        const rgb = hslToRgb(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * val)));
        r = rgb.r;
        g = rgb.g;
        b = rgb.b;
      } else if (mln === 'lumOff') {
        const hsl = rgbToHsl(r, g, b);
        const rgb = hslToRgb(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + val)));
        r = rgb.r;
        g = rgb.g;
        b = rgb.b;
      } else if (mln === 'satMod') {
        const hsl = rgbToHsl(r, g, b);
        const rgb = hslToRgb(hsl.h, Math.max(0, Math.min(1, hsl.s * val)), hsl.l);
        r = rgb.r;
        g = rgb.g;
        b = rgb.b;
      }
    }
  }

  if (alpha < 0.999) {
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

async function resolveMediaDataUrl(
  zip: JSZip,
  mediaPath: string,
  cache: Map<string, string>
): Promise<string | null> {
  if (cache.has(mediaPath)) return cache.get(mediaPath)!;
  const entry = zip.file(mediaPath);
  if (!entry) return null;
  const lower = mediaPath.toLowerCase();
  const mime = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.svg')
      ? 'image/svg+xml'
      : lower.endsWith('.gif')
        ? 'image/gif'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : lower.endsWith('.bmp')
            ? 'image/bmp'
            : 'image/jpeg';

  try {
    const b64 = await entry.async('base64');
    let dataUrl = `data:${mime};base64,${b64}`;

    // Resize oversized embedded photos gently so slide playback & IndexedDB remain fast
    if (
      (mime === 'image/png' || mime === 'image/jpeg') &&
      b64.length > 550000 &&
      typeof document !== 'undefined'
    ) {
      dataUrl = await downscaleDataUrl(dataUrl, mime, 1600);
    }

    cache.set(mediaPath, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

function downscaleDataUrl(dataUrl: string, mime: string, maxDim: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      if (ratio >= 0.98) {
        resolve(dataUrl);
        return;
      }
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * ratio));
      c.height = Math.max(1, Math.round(img.height * ratio));
      const ctx = c.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL(mime === 'image/png' ? 'image/png' : 'image/jpeg', 0.88));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function resolveFillNode(
  container: Element | null | undefined,
  rels: Map<string, string>,
  zip: JSZip,
  mediaCache: Map<string, string>,
  ctx: ColorContext,
  phColor?: string
): Promise<PptxFill | null> {
  if (!container) return null;
  if (childByName(container, 'noFill')) return { type: 'none' };

  const solid = childByName(container, 'solidFill');
  if (solid) {
    const c = resolveColorNode(solid, ctx, phColor);
    if (c) return { type: 'solid', color: c };
  }

  const grad = childByName(container, 'gradFill');
  if (grad) {
    const gsLst = childByName(grad, 'gsLst');
    const stops: { pos: number; color: string }[] = [];
    if (gsLst) {
      for (const gs of childrenByName(gsLst, 'gs')) {
        const pos = Number(gs.getAttribute('pos') || 0) / 1000;
        const c = resolveColorNode(gs, ctx, phColor) || '#CBD5E1';
        stops.push({ pos: Math.max(0, Math.min(100, pos)), color: c });
      }
    }
    stops.sort((a, b) => a.pos - b.pos);
    const lin = childByName(grad, 'lin');
    const pathEl = childByName(grad, 'path');
    const angleRaw = lin ? Number(lin.getAttribute('ang') || 0) / 60000 : 90;
    // OOXML linear gradient angle 0 is left->right (CSS 90deg)
    const angleDeg = (angleRaw + 90) % 360;
    if (stops.length > 0) {
      return {
        type: 'gradient',
        kind: pathEl ? 'radial' : 'linear',
        angleDeg,
        stops,
      };
    }
  }

  const blipFill = childByName(container, 'blipFill');
  if (blipFill) {
    const blip = childByName(blipFill, 'blip');
    const rId =
      blip?.getAttribute('r:embed') ||
      blip?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') ||
      blip?.getAttribute('embed') ||
      '';
    const mediaPath = rId ? rels.get(rId) : undefined;
    if (mediaPath) {
      const src = await resolveMediaDataUrl(zip, mediaPath, mediaCache);
      if (src) {
        const tile = childByName(blipFill, 'tile');
        return { type: 'image', src, mode: tile ? 'tile' : 'stretch' };
      }
    }
  }

  return null;
}

function resolveStrokeNode(
  lnEl: Element | null | undefined,
  ctx: ColorContext,
  emuToPx: number,
  phColor?: string
): PptxStroke | undefined {
  if (!lnEl) return undefined;
  if (childByName(lnEl, 'noFill')) return undefined;
  const solid = childByName(lnEl, 'solidFill');
  const grad = childByName(lnEl, 'gradFill');
  let color: string | null = null;
  if (solid) color = resolveColorNode(solid, ctx, phColor);
  else if (grad) {
    const gsLst = childByName(grad, 'gsLst');
    const firstGs = gsLst ? childrenByName(gsLst, 'gs')[0] : null;
    color = resolveColorNode(firstGs, ctx, phColor);
  }
  if (!color) return undefined;

  const wEmu = Number(lnEl.getAttribute('w') || 12700); // default 1pt = 12700 EMU
  const width = Math.max(1, wEmu * emuToPx);
  const prstDash = childByName(lnEl, 'prstDash')?.getAttribute('val') || 'solid';
  const dash: PptxStroke['dash'] =
    prstDash === 'dot' || prstDash === 'sysDot'
      ? 'dot'
      : prstDash === 'dashDot' || prstDash === 'lgDashDot' || prstDash === 'sysDashDot'
        ? 'dashDot'
        : prstDash !== 'solid'
          ? 'dash'
          : 'solid';

  const headEnd = (childByName(lnEl, 'headEnd')?.getAttribute('type') || 'none') as PptxStroke['headEnd'];
  const tailEnd = (childByName(lnEl, 'tailEnd')?.getAttribute('type') || 'none') as PptxStroke['tailEnd'];

  return { color, width, dash, headEnd, tailEnd };
}

function resolveShadowNode(
  effectLst: Element | null | undefined,
  ctx: ColorContext,
  emuToPx: number
): PptxShadow | undefined {
  if (!effectLst) return undefined;
  const shdw = childByName(effectLst, 'outerShdw');
  if (!shdw) return undefined;
  const color = resolveColorNode(shdw, ctx) || 'rgba(0,0,0,0.28)';
  const blur = Number(shdw.getAttribute('blurRad') || 50800) * emuToPx;
  const distEmu = Number(shdw.getAttribute('dist') || 38100);
  const dirDeg = Number(shdw.getAttribute('dir') || 2700000) / 60000;
  const rad = (dirDeg * Math.PI) / 180;
  return {
    color,
    blur: Math.max(2, blur),
    offsetX: Math.cos(rad) * distEmu * emuToPx,
    offsetY: Math.sin(rad) * distEmu * emuToPx,
  };
}

interface TextStyleDefault {
  fontSizePt?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: PptxParagraph['align'];
  bulletChar?: string;
  marginLeftPx?: number;
  indentPx?: number;
}

function extractLevelStyle(
  pPr: Element | null | undefined,
  ctx: ColorContext,
  emuToPx: number
): TextStyleDefault {
  if (!pPr) return {};
  const out: TextStyleDefault = {};
  const algn = pPr.getAttribute('algn');
  if (algn === 'ctr') out.align = 'center';
  else if (algn === 'r') out.align = 'right';
  else if (algn === 'just') out.align = 'justify';
  else if (algn === 'l') out.align = 'left';

  const marL = pPr.getAttribute('marL');
  if (marL !== null) out.marginLeftPx = Number(marL) * emuToPx;
  const indent = pPr.getAttribute('indent');
  if (indent !== null) out.indentPx = Number(indent) * emuToPx;

  if (childByName(pPr, 'buNone')) {
    out.bulletChar = '';
  } else {
    const buChar = childByName(pPr, 'buChar');
    if (buChar) out.bulletChar = buChar.getAttribute('char') || '•';
    const buAuto = childByName(pPr, 'buAutoNum');
    if (buAuto) out.bulletChar = 'AUTO';
  }

  const defRPr = childByName(pPr, 'defRPr');
  if (defRPr) {
    const sz = defRPr.getAttribute('sz');
    if (sz) out.fontSizePt = Number(sz) / 100;
    const b = defRPr.getAttribute('b');
    if (b === '1' || b === 'true') out.bold = true;
    else if (b === '0' || b === 'false') out.bold = false;
    const it = defRPr.getAttribute('i');
    if (it === '1' || it === 'true') out.italic = true;
    const solid = childByName(defRPr, 'solidFill');
    const c = resolveColorNode(solid, ctx);
    if (c) out.color = c;
    const latin = childByName(defRPr, 'latin') || childByName(defRPr, 'ea');
    const tf = latin?.getAttribute('typeface');
    if (tf) {
      out.fontFamily =
        tf === '+mj-lt'
          ? ctx.themeFontMajor
          : tf === '+mn-lt'
            ? ctx.themeFontMinor
            : tf;
    }
  }
  return out;
}

function parseTextBody(
  txBody: Element | null | undefined,
  ctx: ColorContext,
  emuToPx: number,
  ptToPx: number,
  slideNumber: number,
  inheritedLevels?: Record<number, TextStyleDefault>,
  shapeStyleColor?: string
): {
  paragraphs: PptxParagraph[];
  verticalAlign: 'top' | 'middle' | 'bottom';
  insets: { l: number; t: number; r: number; b: number };
  wordWrap: boolean;
} {
  if (!txBody) {
    return {
      paragraphs: [],
      verticalAlign: 'middle',
      insets: { l: 8, t: 4, r: 8, b: 4 },
      wordWrap: true,
    };
  }

  const bodyPr = childByName(txBody, 'bodyPr');
  const anchor = bodyPr?.getAttribute('anchor') || 't';
  const verticalAlign: 'top' | 'middle' | 'bottom' =
    anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top';
  const wrapAttr = bodyPr?.getAttribute('wrap');
  const wordWrap = wrapAttr !== 'none';

  const insets = {
    l: bodyPr?.hasAttribute('lIns') ? Number(bodyPr.getAttribute('lIns')) * emuToPx : 10,
    t: bodyPr?.hasAttribute('tIns') ? Number(bodyPr.getAttribute('tIns')) * emuToPx : 6,
    r: bodyPr?.hasAttribute('rIns') ? Number(bodyPr.getAttribute('rIns')) * emuToPx : 10,
    b: bodyPr?.hasAttribute('bIns') ? Number(bodyPr.getAttribute('bIns')) * emuToPx : 6,
  };

  const localLstStyle = childByName(txBody, 'lstStyle');
  const localLevels: Record<number, TextStyleDefault> = {};
  if (localLstStyle) {
    for (let lvl = 1; lvl <= 9; lvl++) {
      const node = childByName(localLstStyle, `lvl${lvl}pPr`);
      if (node) localLevels[lvl - 1] = extractLevelStyle(node, ctx, emuToPx);
    }
  }

  const paragraphs: PptxParagraph[] = [];
  const pNodes = childrenByName(txBody, 'p');

  let autoNumCounter = 1;

  for (const pNode of pNodes) {
    const pPr = childByName(pNode, 'pPr');
    const lvl = Number(pPr?.getAttribute('lvl') || 0);
    const pStyle = extractLevelStyle(pPr, ctx, emuToPx);
    const inh = inheritedLevels?.[lvl] || inheritedLevels?.[0] || {};
    const loc = localLevels[lvl] || localLevels[0] || {};

    const align = pStyle.align || loc.align || inh.align || 'left';
    const marginLeftPx = pStyle.marginLeftPx ?? loc.marginLeftPx ?? inh.marginLeftPx ?? (lvl > 0 ? lvl * 28 : 0);
    const indentPx = pStyle.indentPx ?? loc.indentPx ?? inh.indentPx ?? 0;

    let bulletChar = pStyle.bulletChar ?? loc.bulletChar ?? inh.bulletChar;
    if (bulletChar === 'AUTO') {
      bulletChar = `${autoNumCounter}.`;
      autoNumCounter++;
    } else if (!bulletChar) {
      autoNumCounter = 1;
    }

    const buClrNode = childByName(pPr, 'buClr');
    const bulletColor = resolveColorNode(buClrNode, ctx) || undefined;

    const spcBefNode = childByName(pPr, 'spcBef');
    const spcBefPts = childByName(spcBefNode, 'spcPts')?.getAttribute('val');
    const spaceBeforePx = spcBefPts ? (Number(spcBefPts) / 100) * ptToPx : undefined;

    const spcAftNode = childByName(pPr, 'spcAft');
    const spcAftPts = childByName(spcAftNode, 'spcPts')?.getAttribute('val');
    const spaceAfterPx = spcAftPts ? (Number(spcAftPts) / 100) * ptToPx : undefined;

    const lnSpcNode = childByName(pPr, 'lnSpc');
    const lnSpcPct = childByName(lnSpcNode, 'spcPct')?.getAttribute('val');
    const lineHeight = lnSpcPct ? Math.max(0.9, Number(lnSpcPct) / 100000) : 1.2;

    const defaultFontPt = pStyle.fontSizePt ?? loc.fontSizePt ?? inh.fontSizePt ?? 18;
    const defaultFontFamily = pStyle.fontFamily ?? loc.fontFamily ?? inh.fontFamily ?? ctx.themeFontMinor;
    const defaultColor = pStyle.color ?? loc.color ?? inh.color ?? shapeStyleColor ?? ctx.themeColors.tx1 ?? '#0F172A';
    const defaultBold = pStyle.bold ?? loc.bold ?? inh.bold ?? false;
    const defaultItalic = pStyle.italic ?? loc.italic ?? inh.italic ?? false;

    const runs: PptxRun[] = [];
    for (let i = 0; i < pNode.children.length; i++) {
      const ch = pNode.children[i];
      const ln = localName(ch);
      if (ln === 'r' || ln === 'fld') {
        const rPr = childByName(ch, 'rPr');
        const tEl = childByName(ch, 't');
        let text = tEl?.textContent ?? '';
        if (ln === 'fld' && ch.getAttribute('type') === 'slidenum') {
          text = String(slideNumber);
        }
        const sz = rPr?.getAttribute('sz');
        const fontSizePt = sz ? Number(sz) / 100 : defaultFontPt;
        const bAttr = rPr?.getAttribute('b');
        const bold = bAttr !== null ? bAttr === '1' || bAttr === 'true' : defaultBold;
        const iAttr = rPr?.getAttribute('i');
        const italic = iAttr !== null ? iAttr === '1' || iAttr === 'true' : defaultItalic;
        const uAttr = rPr?.getAttribute('u');
        const underline = Boolean(uAttr && uAttr !== 'none');
        const sAttr = rPr?.getAttribute('strike');
        const strike = Boolean(sAttr && sAttr !== 'noStrike');
        const baselineAttr = rPr?.getAttribute('baseline');
        const baseline = baselineAttr ? Number(baselineAttr) : undefined;

        const rColor = resolveColorNode(childByName(rPr, 'solidFill'), ctx) || defaultColor;
        const latin = childByName(rPr, 'latin') || childByName(rPr, 'ea');
        const rawTf = latin?.getAttribute('typeface');
        const fontFamily = rawTf
          ? rawTf === '+mj-lt'
            ? ctx.themeFontMajor
            : rawTf === '+mn-lt'
              ? ctx.themeFontMinor
              : rawTf
          : defaultFontFamily;

        runs.push({
          text,
          fontFamily,
          fontSizePx: Math.max(8, fontSizePt * ptToPx),
          color: rColor,
          bold,
          italic,
          underline,
          strike,
          baseline,
        });
      } else if (ln === 'br') {
        runs.push({
          text: '\n',
          fontFamily: defaultFontFamily,
          fontSizePx: Math.max(8, defaultFontPt * ptToPx),
          color: defaultColor,
        });
      }
    }

    if (runs.length === 0) {
      const endParaRPr = childByName(pNode, 'endParaRPr');
      const sz = endParaRPr?.getAttribute('sz');
      const fontSizePt = sz ? Number(sz) / 100 : defaultFontPt;
      runs.push({
        text: '',
        fontFamily: defaultFontFamily,
        fontSizePx: Math.max(8, fontSizePt * ptToPx),
        color: defaultColor,
      });
    }

    paragraphs.push({
      align,
      level: lvl,
      marginLeftPx,
      indentPx,
      spaceBeforePx,
      spaceAfterPx,
      lineHeight,
      bulletChar: bulletChar || undefined,
      bulletColor,
      runs,
    });
  }

  return { paragraphs, verticalAlign, insets, wordWrap };
}

function parseCustomGeomPath(custGeom: Element): { d: string; w: number; h: number } | null {
  const pathLst = childByName(custGeom, 'pathLst');
  const firstPath = pathLst ? childrenByName(pathLst, 'path')[0] : null;
  if (!firstPath) return null;
  const w = Number(firstPath.getAttribute('w') || 1000);
  const h = Number(firstPath.getAttribute('h') || 1000);
  const cmds: string[] = [];

  for (let i = 0; i < firstPath.children.length; i++) {
    const cmd = firstPath.children[i];
    const ln = localName(cmd);
    if (ln === 'moveTo') {
      const pt = childByName(cmd, 'pt');
      if (pt) cmds.push(`M ${pt.getAttribute('x') || 0} ${pt.getAttribute('y') || 0}`);
    } else if (ln === 'lnTo') {
      const pt = childByName(cmd, 'pt');
      if (pt) cmds.push(`L ${pt.getAttribute('x') || 0} ${pt.getAttribute('y') || 0}`);
    } else if (ln === 'cubicBezTo') {
      const pts = childrenByName(cmd, 'pt');
      if (pts.length === 3) {
        cmds.push(
          `C ${pts[0].getAttribute('x') || 0} ${pts[0].getAttribute('y') || 0}, ${pts[1].getAttribute('x') || 0} ${pts[1].getAttribute('y') || 0}, ${pts[2].getAttribute('x') || 0} ${pts[2].getAttribute('y') || 0}`
        );
      }
    } else if (ln === 'quadBezTo') {
      const pts = childrenByName(cmd, 'pt');
      if (pts.length === 2) {
        cmds.push(
          `Q ${pts[0].getAttribute('x') || 0} ${pts[0].getAttribute('y') || 0}, ${pts[1].getAttribute('x') || 0} ${pts[1].getAttribute('y') || 0}`
        );
      }
    } else if (ln === 'close') {
      cmds.push('Z');
    }
  }

  if (cmds.length === 0) return null;
  return { d: cmds.join(' '), w: Math.max(1, w), h: Math.max(1, h) };
}

interface PlaceholderSlot {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  fill?: PptxFill;
  stroke?: PptxStroke;
  levels?: Record<number, TextStyleDefault>;
}

interface PlaceholderBag {
  byIdx: Map<string, PlaceholderSlot>;
  byType: Map<string, PlaceholderSlot>;
}

function getPhKey(nvPr: Element | null | undefined): { type?: string; idx?: string } {
  const ph = childByName(nvPr, 'ph');
  if (!ph) return {};
  return {
    type: ph.getAttribute('type') || undefined,
    idx: ph.getAttribute('idx') || undefined,
  };
}

function readXfrmBox(
  xfrm: Element | null | undefined,
  emuToPx: number
): { x: number; y: number; width: number; height: number; rotation: number; flipH: boolean; flipV: boolean } | null {
  if (!xfrm) return null;
  const off = childByName(xfrm, 'off');
  const ext = childByName(xfrm, 'ext');
  if (!off || !ext) return null;
  return {
    x: Number(off.getAttribute('x') || 0) * emuToPx,
    y: Number(off.getAttribute('y') || 0) * emuToPx,
    width: Math.max(1, Number(ext.getAttribute('cx') || 0) * emuToPx),
    height: Math.max(1, Number(ext.getAttribute('cy') || 0) * emuToPx),
    rotation: Number(xfrm.getAttribute('rot') || 0) / 60000,
    flipH: xfrm.getAttribute('flipH') === '1' || xfrm.getAttribute('flipH') === 'true',
    flipV: xfrm.getAttribute('flipV') === '1' || xfrm.getAttribute('flipV') === 'true',
  };
}

async function parseChartPart(
  zip: JSZip,
  chartPath: string,
  base: { id: string; shapeId: string; x: number; y: number; width: number; height: number; rotation: number },
  ctx: ColorContext
): Promise<PptxChartElement | null> {
  const entry = zip.file(chartPath);
  if (!entry) return null;
  const xml = await entry.async('text');
  const doc = parseXml(xml);
  const root = doc.documentElement;

  const plotArea = findDescendants(root, 'plotArea')[0];
  if (!plotArea) return null;

  let chartType: PptxChartElement['chartType'] = 'bar';
  let chartNode = childByName(plotArea, 'barChart') || childByName(plotArea, 'bar3DChart');
  if (!chartNode) {
    chartNode = childByName(plotArea, 'lineChart') || childByName(plotArea, 'line3DChart');
    if (chartNode) chartType = 'line';
  }
  if (!chartNode) {
    chartNode = childByName(plotArea, 'pieChart') || childByName(plotArea, 'pie3DChart');
    if (chartNode) chartType = 'pie';
  }
  if (!chartNode) {
    chartNode = childByName(plotArea, 'doughnutChart');
    if (chartNode) chartType = 'doughnut';
  }
  if (!chartNode) {
    chartNode = childByName(plotArea, 'areaChart');
    if (chartNode) chartType = 'area';
  }
  if (!chartNode) return null;

  const titleNode = findDescendants(root, 'title')[0];
  const titleText = titleNode
    ? findDescendants(titleNode, 't')
        .map((t) => t.textContent || '')
        .join('')
        .trim()
    : undefined;

  const serNodes = childrenByName(chartNode, 'ser');
  const categories: string[] = [];
  const series: PptxChartSeries[] = [];

  serNodes.forEach((ser, idx) => {
    const txNode = childByName(ser, 'tx');
    const name =
      findDescendants(txNode, 'v')[0]?.textContent?.trim() ||
      findDescendants(txNode, 't')[0]?.textContent?.trim() ||
      `Chuỗi ${idx + 1}`;

    if (categories.length === 0) {
      const catNode = childByName(ser, 'cat');
      const pts = findDescendants(catNode, 'pt');
      for (const p of pts) {
        const v = childByName(p, 'v')?.textContent ?? '';
        categories.push(v);
      }
    }

    const valNode = childByName(ser, 'val');
    const vPts = findDescendants(valNode, 'pt');
    const values = vPts.map((p) => Number(childByName(p, 'v')?.textContent || 0));

    const spPr = childByName(ser, 'spPr');
    const solid = childByName(spPr, 'solidFill');
    const explicitColor = resolveColorNode(solid, ctx);
    const themeFallback = ctx.themeColors[`accent${(idx % 6) + 1}`];
    const color = explicitColor || themeFallback || DEFAULT_CHART_PALETTE[idx % DEFAULT_CHART_PALETTE.length];

    series.push({ name, color, values });
  });

  if (categories.length === 0 && series[0]) {
    series[0].values.forEach((_, i) => categories.push(`${i + 1}`));
  }

  return {
    ...base,
    kind: 'chart',
    chartType,
    title: titleText || undefined,
    categories,
    series,
    showLegend: Boolean(findDescendants(root, 'legend')[0]),
  };
}

async function parseSpTree(
  spTree: Element | null | undefined,
  rels: Map<string, string>,
  zip: JSZip,
  mediaCache: Map<string, string>,
  ctx: ColorContext,
  emuToPx: number,
  ptToPx: number,
  slideNumber: number,
  phBag?: PlaceholderBag,
  skipPlaceholders = false
): Promise<PptxElement[]> {
  const out: PptxElement[] = [];
  if (!spTree) return out;

  const processChildren = async (
    container: Element,
    transformFn?: (box: { x: number; y: number; width: number; height: number; rotation: number }) => {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
    },
    overrideGroupShapeId?: string
  ) => {
    for (let i = 0; i < container.children.length; i++) {
      let node = container.children[i];
      if (localName(node) === 'AlternateContent') {
        const choice = childByName(node, 'Choice');
        const fallback = childByName(node, 'Fallback');
        const picked = choice?.firstElementChild || fallback?.firstElementChild;
        if (!picked) continue;
        node = picked;
      }

      const ln = localName(node);
      if (ln === 'grpSp') {
        const nvGrp = childByName(node, 'nvGrpSpPr');
        const cNvPr = childByName(nvGrp, 'cNvPr');
        const grpShapeId = overrideGroupShapeId || cNvPr?.getAttribute('id') || '';
        const grpSpPr = childByName(node, 'grpSpPr');
        const xfrm = childByName(grpSpPr, 'xfrm');
        const off = childByName(xfrm, 'off');
        const ext = childByName(xfrm, 'ext');
        const chOff = childByName(xfrm, 'chOff');
        const chExt = childByName(xfrm, 'chExt');
        if (off && ext && chOff && chExt) {
          const gx = Number(off.getAttribute('x') || 0) * emuToPx;
          const gy = Number(off.getAttribute('y') || 0) * emuToPx;
          const gw = Math.max(1, Number(ext.getAttribute('cx') || 1) * emuToPx);
          const gh = Math.max(1, Number(ext.getAttribute('cy') || 1) * emuToPx);
          const cx0 = Number(chOff.getAttribute('x') || 0) * emuToPx;
          const cy0 = Number(chOff.getAttribute('y') || 0) * emuToPx;
          const cw = Math.max(1, Number(chExt.getAttribute('cx') || 1) * emuToPx);
          const ch = Math.max(1, Number(chExt.getAttribute('cy') || 1) * emuToPx);
          const sx = gw / cw;
          const sy = gh / ch;
          const nextTransform = (box: { x: number; y: number; width: number; height: number; rotation: number }) => {
            const mapped = {
              x: gx + (box.x - cx0) * sx,
              y: gy + (box.y - cy0) * sy,
              width: box.width * sx,
              height: box.height * sy,
              rotation: box.rotation,
            };
            return transformFn ? transformFn(mapped) : mapped;
          };
          await processChildren(node, nextTransform, grpShapeId || undefined);
        } else {
          await processChildren(node, transformFn, grpShapeId || undefined);
        }
        continue;
      }

      if (ln === 'sp' || ln === 'cxnSp') {
        const nvSpPr = childByName(node, ln === 'cxnSp' ? 'nvCxnSpPr' : 'nvSpPr');
        const cNvPr = childByName(nvSpPr, 'cNvPr');
        const nvPr = childByName(nvSpPr, 'nvPr');
        const ph = getPhKey(nvPr);
        if (skipPlaceholders && (ph.type || ph.idx)) continue;

        const spPr = childByName(node, 'spPr');
        const xfrm = childByName(spPr, 'xfrm');
        let rawBox = readXfrmBox(xfrm, emuToPx);

        const phSlot =
          (ph.idx !== undefined ? phBag?.byIdx.get(ph.idx) : undefined) ||
          (ph.type ? phBag?.byType.get(ph.type) : undefined);

        if (!rawBox && phSlot && phSlot.x !== undefined && phSlot.width !== undefined) {
          rawBox = {
            x: phSlot.x,
            y: phSlot.y ?? 0,
            width: phSlot.width,
            height: phSlot.height ?? 100,
            rotation: phSlot.rotation ?? 0,
            flipH: false,
            flipV: false,
          };
        }
        if (!rawBox) continue;

        const mappedBox = transformFn ? transformFn(rawBox) : rawBox;
        const shapeId = cNvPr?.getAttribute('id') || uid('sp');

        const styleEl = childByName(node, 'style');
        const fillRef = childByName(styleEl, 'fillRef');
        const lnRef = childByName(styleEl, 'lnRef');
        const fontRef = childByName(styleEl, 'fontRef');
        const styleFillColor =
          fillRef && Number(fillRef.getAttribute('idx') || 0) > 0
            ? resolveColorNode(fillRef, ctx)
            : null;
        const styleStrokeColor =
          lnRef && Number(lnRef.getAttribute('idx') || 0) > 0
            ? resolveColorNode(lnRef, ctx)
            : null;
        const styleFontColor = fontRef ? resolveColorNode(fontRef, ctx) : null;

        let fill: PptxFill | null = await resolveFillNode(spPr, rels, zip, mediaCache, ctx);
        if (!fill && phSlot?.fill) fill = phSlot.fill;
        if (!fill && styleFillColor) fill = { type: 'solid', color: styleFillColor };
        if (!fill) fill = { type: 'none' };

        const prstGeomEl = childByName(spPr, 'prstGeom');
        const custGeomEl = childByName(spPr, 'custGeom');
        const isConnector = ln === 'cxnSp';
        let presetGeom = prstGeomEl?.getAttribute('prst') || (isConnector ? 'line' : 'rect');
        const customPath = custGeomEl ? parseCustomGeomPath(custGeomEl) : null;

        const adj: number[] = [];
        const avLst = childByName(prstGeomEl, 'avLst');
        if (avLst) {
          for (const gd of childrenByName(avLst, 'gd')) {
            const fmla = gd.getAttribute('fmla') || '';
            const m = fmla.match(/val\s+(-?\d+)/);
            if (m) adj.push(Number(m[1]) / 100000);
          }
        }

        const lnEl = childByName(spPr, 'ln');
        let stroke = resolveStrokeNode(lnEl, ctx, emuToPx);
        if (!stroke && lnEl === null && phSlot?.stroke) stroke = phSlot.stroke;
        if (!stroke && styleStrokeColor && !childByName(lnEl, 'noFill')) {
          stroke = { color: styleStrokeColor, width: 1.5, dash: 'solid' };
        }
        if ((presetGeom === 'line' || presetGeom === 'straightConnector1') && !stroke) {
          stroke = { color: styleStrokeColor || '#334155', width: 2, dash: 'solid' };
        }

        const shadow = resolveShadowNode(childByName(spPr, 'effectLst'), ctx, emuToPx);
        const txBody = childByName(node, 'txBody');

        // Merge placeholder levels + master title/body/other levels
        const bodyParsed = parseTextBody(
          txBody,
          ctx,
          emuToPx,
          ptToPx,
          slideNumber,
          phSlot?.levels,
          styleFontColor || undefined
        );

        const shapeEl: PptxShapeElement = {
          id: uid('el'),
          shapeId: overrideGroupShapeId || shapeId,
          kind: 'shape',
          x: mappedBox.x,
          y: mappedBox.y,
          width: mappedBox.width,
          height: mappedBox.height,
          rotation: mappedBox.rotation,
          flipH: rawBox.flipH,
          flipV: rawBox.flipV,
          presetGeom,
          customPathD: customPath?.d,
          customPathW: customPath?.w,
          customPathH: customPath?.h,
          fill,
          stroke,
          shadow,
          paragraphs: bodyParsed.paragraphs,
          verticalAlign: bodyParsed.verticalAlign,
          insets: bodyParsed.insets,
          wordWrap: bodyParsed.wordWrap,
          adj: adj.length > 0 ? adj : undefined,
        };
        out.push(shapeEl);
        continue;
      }

      if (ln === 'pic') {
        const nvPicPr = childByName(node, 'nvPicPr');
        const cNvPr = childByName(nvPicPr, 'cNvPr');
        const nvPr = childByName(nvPicPr, 'nvPr');
        const ph = getPhKey(nvPr);
        if (skipPlaceholders && (ph.type || ph.idx)) continue;

        const spPr = childByName(node, 'spPr');
        const xfrm = childByName(spPr, 'xfrm');
        const rawBox = readXfrmBox(xfrm, emuToPx);
        if (!rawBox) continue;

        const blipFill = childByName(node, 'blipFill');
        const blip = childByName(blipFill, 'blip');
        const rId =
          blip?.getAttribute('r:embed') ||
          blip?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') ||
          blip?.getAttribute('embed') ||
          '';
        const mediaPath = rId ? rels.get(rId) : undefined;
        if (!mediaPath) continue;
        const src = await resolveMediaDataUrl(zip, mediaPath, mediaCache);
        if (!src) continue;

        const srcRect = childByName(blipFill, 'srcRect');
        const crop = srcRect
          ? {
              l: Number(srcRect.getAttribute('l') || 0) / 100000,
              t: Number(srcRect.getAttribute('t') || 0) / 100000,
              r: Number(srcRect.getAttribute('r') || 0) / 100000,
              b: Number(srcRect.getAttribute('b') || 0) / 100000,
            }
          : undefined;

        const mappedBox = transformFn ? transformFn(rawBox) : rawBox;
        const prstGeom = childByName(spPr, 'prstGeom')?.getAttribute('prst') || 'rect';
        const stroke = resolveStrokeNode(childByName(spPr, 'ln'), ctx, emuToPx);
        const shadow = resolveShadowNode(childByName(spPr, 'effectLst'), ctx, emuToPx);

        const imgEl: PptxImageElement = {
          id: uid('img'),
          shapeId: overrideGroupShapeId || cNvPr?.getAttribute('id') || uid('pic'),
          kind: 'image',
          x: mappedBox.x,
          y: mappedBox.y,
          width: mappedBox.width,
          height: mappedBox.height,
          rotation: mappedBox.rotation,
          flipH: rawBox.flipH,
          flipV: rawBox.flipV,
          src,
          crop,
          clipGeom: prstGeom,
          stroke,
          shadow,
        };
        out.push(imgEl);
        continue;
      }

      if (ln === 'graphicFrame') {
        const nvGfPr = childByName(node, 'nvGraphicFramePr');
        const cNvPr = childByName(nvGfPr, 'cNvPr');
        const xfrm = childByName(node, 'xfrm');
        const rawBox = readXfrmBox(xfrm, emuToPx);
        if (!rawBox) continue;
        const mappedBox = transformFn ? transformFn(rawBox) : rawBox;
        const shapeId = overrideGroupShapeId || cNvPr?.getAttribute('id') || uid('gf');

        const graphic = childByName(node, 'graphic');
        const graphicData = childByName(graphic, 'graphicData');
        const tbl = childByName(graphicData, 'tbl');

        if (tbl) {
          const tblGrid = childByName(tbl, 'tblGrid');
          const gridCols = tblGrid ? childrenByName(tblGrid, 'gridCol') : [];
          const rawColWidths = gridCols.map((c) => Math.max(20, Number(c.getAttribute('w') || 1000000) * emuToPx));
          const sumW = rawColWidths.reduce((a, b) => a + b, 0) || mappedBox.width;
          const colWidths = rawColWidths.map((w) => (w / sumW) * mappedBox.width);

          const trNodes = childrenByName(tbl, 'tr');
          const rawRowHeights = trNodes.map((r) => Math.max(20, Number(r.getAttribute('h') || 400000) * emuToPx));
          const sumH = rawRowHeights.reduce((a, b) => a + b, 0) || mappedBox.height;
          const rowHeights = rawRowHeights.map((h) => (h / sumH) * mappedBox.height);

          const rows: PptxTableCell[][] = [];
          for (const tr of trNodes) {
            const rowCells: PptxTableCell[] = [];
            for (const tc of childrenByName(tr, 'tc')) {
              const tcPr = childByName(tc, 'tcPr');
              const cellFill = (await resolveFillNode(tcPr, rels, zip, mediaCache, ctx)) || { type: 'none' };
              const anchor = tcPr?.getAttribute('anchor') || 'ctr';
              const verticalAlign: 'top' | 'middle' | 'bottom' =
                anchor === 't' ? 'top' : anchor === 'b' ? 'bottom' : 'middle';
              const borders = {
                top: resolveStrokeNode(childByName(tcPr, 'lnT'), ctx, emuToPx),
                right: resolveStrokeNode(childByName(tcPr, 'lnR'), ctx, emuToPx),
                bottom: resolveStrokeNode(childByName(tcPr, 'lnB'), ctx, emuToPx),
                left: resolveStrokeNode(childByName(tcPr, 'lnL'), ctx, emuToPx),
              };
              const txBody = childByName(tc, 'txBody');
              const parsed = parseTextBody(txBody, ctx, emuToPx, ptToPx, slideNumber);
              rowCells.push({
                fill: cellFill,
                paragraphs: parsed.paragraphs,
                verticalAlign,
                gridSpan: tc.hasAttribute('gridSpan') ? Number(tc.getAttribute('gridSpan')) : undefined,
                rowSpan: tc.hasAttribute('rowSpan') ? Number(tc.getAttribute('rowSpan')) : undefined,
                hMerge: tc.getAttribute('hMerge') === '1',
                vMerge: tc.getAttribute('vMerge') === '1',
                borders,
              });
            }
            rows.push(rowCells);
          }

          const tableEl: PptxTableElement = {
            id: uid('tbl'),
            shapeId,
            kind: 'table',
            x: mappedBox.x,
            y: mappedBox.y,
            width: mappedBox.width,
            height: mappedBox.height,
            rotation: mappedBox.rotation,
            colWidths,
            rowHeights,
            rows,
          };
          out.push(tableEl);
          continue;
        }

        const chartRef = childByName(graphicData, 'chart');
        if (chartRef) {
          const rId =
            chartRef.getAttribute('r:id') ||
            chartRef.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ||
            chartRef.getAttribute('id') ||
            '';
          const chartPath = rId ? rels.get(rId) : undefined;
          if (chartPath) {
            const chartEl = await parseChartPart(
              zip,
              chartPath,
              {
                id: uid('chart'),
                shapeId,
                x: mappedBox.x,
                y: mappedBox.y,
                width: mappedBox.width,
                height: mappedBox.height,
                rotation: mappedBox.rotation,
              },
              ctx
            );
            if (chartEl) out.push(chartEl);
          }
        }
      }
    }
  };

  await processChildren(spTree);
  return out;
}

function collectPlaceholderBag(
  spTree: Element | null | undefined,
  ctx: ColorContext,
  emuToPx: number
): PlaceholderBag {
  const byIdx = new Map<string, PlaceholderSlot>();
  const byType = new Map<string, PlaceholderSlot>();
  if (!spTree) return { byIdx, byType };

  for (const sp of childrenByName(spTree, 'sp')) {
    const nvSpPr = childByName(sp, 'nvSpPr');
    const nvPr = childByName(nvSpPr, 'nvPr');
    const ph = getPhKey(nvPr);
    if (!ph.type && !ph.idx) continue;

    const spPr = childByName(sp, 'spPr');
    const box = readXfrmBox(childByName(spPr, 'xfrm'), emuToPx);
    const txBody = childByName(sp, 'txBody');
    const lstStyle = childByName(txBody, 'lstStyle');
    const levels: Record<number, TextStyleDefault> = {};
    if (lstStyle) {
      for (let lvl = 1; lvl <= 9; lvl++) {
        const node = childByName(lstStyle, `lvl${lvl}pPr`);
        if (node) levels[lvl - 1] = extractLevelStyle(node, ctx, emuToPx);
      }
    }
    const slot: PlaceholderSlot = {
      x: box?.x,
      y: box?.y,
      width: box?.width,
      height: box?.height,
      rotation: box?.rotation,
      stroke: resolveStrokeNode(childByName(spPr, 'ln'), ctx, emuToPx),
      levels: Object.keys(levels).length > 0 ? levels : undefined,
    };
    if (ph.idx !== undefined) byIdx.set(ph.idx, slot);
    if (ph.type) byType.set(ph.type, slot);
  }
  return { byIdx, byType };
}

function mergePlaceholderBags(masterBag: PlaceholderBag, layoutBag: PlaceholderBag): PlaceholderBag {
  const byIdx = new Map(masterBag.byIdx);
  const byType = new Map(masterBag.byType);

  const mergeSlot = (a: PlaceholderSlot | undefined, b: PlaceholderSlot): PlaceholderSlot => ({
    x: b.x ?? a?.x,
    y: b.y ?? a?.y,
    width: b.width ?? a?.width,
    height: b.height ?? a?.height,
    rotation: b.rotation ?? a?.rotation,
    fill: b.fill ?? a?.fill,
    stroke: b.stroke ?? a?.stroke,
    levels: { ...(a?.levels || {}), ...(b.levels || {}) },
  });

  layoutBag.byIdx.forEach((slot, key) => byIdx.set(key, mergeSlot(byIdx.get(key), slot)));
  layoutBag.byType.forEach((slot, key) => byType.set(key, mergeSlot(byType.get(key), slot)));
  return { byIdx, byType };
}

function parseTransition(slideRoot: Element): PptxTransition {
  const trNode = childByName(slideRoot, 'transition');
  if (!trNode) {
    return { type: 'none', durationMs: 0, advanceOnClick: true };
  }

  const advClick = trNode.getAttribute('advClick') !== '0';
  const advTmAttr = trNode.getAttribute('advTm');
  const advanceAfterMs = advTmAttr ? Math.max(200, Number(advTmAttr)) : undefined;

  const durAttr =
    trNode.getAttribute('dur') ||
    trNode.getAttributeNS('http://schemas.microsoft.com/office/powerpoint/2010/main', 'dur');
  const spd = trNode.getAttribute('spd') || 'med';
  const durationMs = durAttr
    ? Math.max(150, Number(durAttr))
    : spd === 'slow'
      ? 1100
      : spd === 'fast'
        ? 350
        : 650;

  let type: PptxTransitionType = 'fade';
  let direction: PptxDirection = 'r';

  for (let i = 0; i < trNode.children.length; i++) {
    const ch = trNode.children[i];
    const ln = localName(ch);
    if (ln === 'sndAc' || ln === 'extLst') continue;
    const dirAttr = (ch.getAttribute('dir') || '') as PptxDirection;
    const orient = ch.getAttribute('orient');
    if (dirAttr) direction = dirAttr;
    else if (orient === 'vert') direction = 'vert';
    else if (orient === 'horz') direction = 'horz';

    if (ln === 'cut') type = 'cut';
    else if (ln === 'fade') type = 'fade';
    else if (ln === 'push') type = 'push';
    else if (ln === 'wipe') type = 'wipe';
    else if (ln === 'cover') type = 'cover';
    else if (ln === 'pull') type = 'uncover';
    else if (ln === 'split') type = 'split';
    else if (ln === 'zoom' || ln === 'flythrough') type = 'zoom';
    else if (ln === 'dissolve' || ln === 'randomBar') type = 'dissolve';
    else if (ln === 'blinds') type = 'blinds';
    else if (ln === 'checker') type = 'checker';
    else if (ln === 'circle') type = 'circle';
    else if (ln === 'diamond') type = 'diamond';
    else if (ln === 'wheel' || ln === 'wedge') type = 'wheel';
    else if (ln === 'morph') type = 'morph';
    else if (ln === 'strips' || ln === 'comb' || ln === 'newsflash' || ln === 'plus') type = 'wipe';
    break;
  }

  return { type, direction, durationMs, advanceOnClick: advClick, advanceAfterMs };
}

function mapPresetToEffect(
  presetClass: PptxAnimClass,
  presetId: number,
  presetSubtype: number,
  filterAttr?: string
): { effectName: PptxAnimEffectName; direction: PptxDirection } {
  let direction: PptxDirection = 'd';
  // Common OOXML presetSubtype direction mappings
  if (presetSubtype === 1 || presetSubtype === 16) direction = 'u'; // fromTop / in
  else if (presetSubtype === 2 || presetSubtype === 8) direction = 'r'; // fromRight
  else if (presetSubtype === 4) direction = 'd'; // fromBottom
  else if (presetSubtype === 8 || presetSubtype === 64) direction = 'l'; // fromLeft
  if (presetSubtype === 10) direction = 'horz';
  if (presetSubtype === 5) direction = 'vert';

  if (filterAttr) {
    if (filterAttr.includes('from(left)')) direction = 'l';
    else if (filterAttr.includes('from(right)')) direction = 'r';
    else if (filterAttr.includes('from(top)')) direction = 'u';
    else if (filterAttr.includes('from(bottom)')) direction = 'd';
    else if (filterAttr.includes('in')) direction = 'in';
    else if (filterAttr.includes('out')) direction = 'out';
  }

  if (presetClass === 'path') return { effectName: 'path', direction };
  if (presetClass === 'emph') {
    if (presetId === 8) return { effectName: 'spin', direction };
    if (presetId === 6) return { effectName: 'growShrink', direction };
    if (presetId === 9) return { effectName: 'teeter', direction };
    return { effectName: 'pulse', direction };
  }

  switch (presetId) {
    case 1:
      return { effectName: 'appear', direction };
    case 2:
      return { effectName: 'fly', direction };
    case 3:
      return { effectName: 'blinds', direction };
    case 4:
      return { effectName: 'box', direction };
    case 6:
      return { effectName: 'circle', direction };
    case 9:
      return { effectName: 'diamond', direction };
    case 10:
      return { effectName: 'fade', direction };
    case 14:
    case 42:
      return { effectName: 'float', direction };
    case 17:
    case 31:
      return { effectName: 'swivel', direction };
    case 18:
      return { effectName: 'split', direction };
    case 21:
      return { effectName: 'wheel', direction };
    case 22:
      return { effectName: 'wipe', direction };
    case 23:
    case 19:
    case 53:
      return { effectName: 'zoom', direction };
    case 26:
      return { effectName: 'bounce', direction };
    default:
      return { effectName: 'fade', direction };
  }
}

function parseTiming(slideRoot: Element): {
  autoEffects: PptxAnimationEffect[];
  clickSteps: PptxAnimationStep[];
} {
  const autoEffects: PptxAnimationEffect[] = [];
  const clickSteps: PptxAnimationStep[] = [];

  const timing = childByName(slideRoot, 'timing');
  if (!timing) return { autoEffects, clickSteps };

  const tnLst = childByName(timing, 'tnLst');
  const rootPar = childByName(tnLst, 'par');
  const rootCTn = childByName(rootPar, 'cTn');
  const rootChildTnLst = childByName(rootCTn, 'childTnLst');
  const mainSeq = childByName(rootChildTnLst, 'seq');
  const mainSeqCTn = childByName(mainSeq, 'cTn');
  const mainChildTnLst = childByName(mainSeqCTn, 'childTnLst');

  if (!mainChildTnLst) return { autoEffects, clickSteps };

  const extractEffectsFromNode = (
    node: Element,
    trigger: 'onClick' | 'withPrevious' | 'afterPrevious',
    inheritedDelayMs = 0
  ): PptxAnimationEffect[] => {
    const out: PptxAnimationEffect[] = [];
    const cTn = childByName(node, 'cTn');
    const stCondLst = childByName(cTn, 'stCondLst');
    const firstCond = stCondLst ? childByName(stCondLst, 'cond') : null;
    const condDelayAttr = firstCond?.getAttribute('delay');
    const ownDelay =
      condDelayAttr && condDelayAttr !== 'indefinite' ? Number(condDelayAttr) || 0 : 0;
    const totalDelay = inheritedDelayMs + ownDelay;

    const presetClass = (cTn?.getAttribute('presetClass') || '') as PptxAnimClass;
    const presetID = Number(cTn?.getAttribute('presetID') || 0);
    const presetSubtype = Number(cTn?.getAttribute('presetSubtype') || 0);
    const nodeType = cTn?.getAttribute('nodeType') || '';
    const ownTrigger: PptxAnimationEffect['trigger'] =
      nodeType === 'clickEffect'
        ? 'onClick'
        : nodeType === 'afterEffect'
          ? 'afterPrevious'
          : nodeType === 'withEffect'
            ? 'withPrevious'
            : trigger;

    if (presetClass || nodeType === 'clickEffect' || nodeType === 'withEffect' || nodeType === 'afterEffect') {
      const childLst = childByName(cTn, 'childTnLst');
      if (childLst && presetID > 0) {
        // Leaf animation group containing set / animEffect / anim / animMotion / animScale / animRot
        const animLeafs = findDescendants(childLst, 'spTgt');
        if (animLeafs.length > 0) {
          const spTgt = animLeafs[0];
          const targetShapeId = spTgt.getAttribute('spid') || '';
          const txEl = childByName(spTgt, 'txEl');
          const pRg = childByName(txEl, 'pRg');
          const paragraphStart = pRg?.hasAttribute('st') ? Number(pRg.getAttribute('st')) : undefined;
          const paragraphEnd = pRg?.hasAttribute('end') ? Number(pRg.getAttribute('end')) : undefined;

          const animEffectEl = findDescendants(childLst, 'animEffect')[0];
          const filterAttr = animEffectEl?.getAttribute('filter') || undefined;
          const animMotionEl = findDescendants(childLst, 'animMotion')[0];
          const animScaleEl = findDescendants(childLst, 'animScale')[0];
          const animRotEl = findDescendants(childLst, 'animRot')[0];

          let maxDur = 0;
          for (const dNode of [animEffectEl, animMotionEl, animScaleEl, animRotEl, ...findDescendants(childLst, 'anim')]) {
            if (!dNode) continue;
            const cBhvr = childByName(dNode, 'cBhvr');
            const bCTn = childByName(cBhvr, 'cTn');
            const d = Number(bCTn?.getAttribute('dur') || 0);
            if (d > maxDur && d < 60000) maxDur = d;
          }
          if (maxDur === 0) {
            const ownDur = Number(cTn?.getAttribute('dur') || 0);
            maxDur = ownDur > 0 && ownDur < 60000 ? ownDur : presetID === 1 ? 80 : 500;
          }

          const mapped = mapPresetToEffect(
            presetClass || 'entr',
            presetID,
            presetSubtype,
            filterAttr
          );

          const byScale = childByName(animScaleEl, 'by');
          const scaleX = byScale ? Number(byScale.getAttribute('x') || 100000) / 100000 : undefined;
          const scaleY = byScale ? Number(byScale.getAttribute('y') || 100000) / 100000 : undefined;
          const byRot = animRotEl?.getAttribute('by');
          const rotateDeg = byRot ? Number(byRot) / 60000 : undefined;

          if (targetShapeId) {
            out.push({
              id: uid('anim'),
              targetShapeId,
              paragraphStart,
              paragraphEnd,
              animClass: presetClass || 'entr',
              presetId: presetID,
              effectName: animMotionEl ? 'path' : mapped.effectName,
              direction: mapped.direction,
              durationMs: Math.max(80, maxDur),
              delayMs: totalDelay,
              trigger: ownTrigger,
              motionPath: animMotionEl?.getAttribute('path') || undefined,
              scaleX,
              scaleY,
              rotateDeg,
            });
            return out;
          }
        }
      }
    }

    const childLst = childByName(cTn, 'childTnLst');
    if (childLst) {
      for (let i = 0; i < childLst.children.length; i++) {
        const sub = childLst.children[i];
        if (localName(sub) === 'par') {
          out.push(...extractEffectsFromNode(sub, ownTrigger, totalDelay));
        }
      }
    }
    return out;
  };

  // Walk top-level <p:par> in main <p:seq>
  const seqPars = childrenByName(mainChildTnLst, 'par');
  for (const seqPar of seqPars) {
    const seqCTn = childByName(seqPar, 'cTn');
    const innerChildLst = childByName(seqCTn, 'childTnLst');
    if (!innerChildLst) continue;

    // Collect all inner pars; split into clickSteps whenever a node is marked clickEffect
    const innerPars = childrenByName(innerChildLst, 'par');
    for (const innerPar of innerPars) {
      const effects = extractEffectsFromNode(innerPar, 'withPrevious', 0);
      for (const eff of effects) {
        if (eff.trigger === 'onClick' || clickSteps.length === 0) {
          if (eff.trigger !== 'onClick' && clickSteps.length === 0) {
            // Check if parent seqPar itself had an onClick condition
            const stCond = childByName(childByName(seqCTn, 'stCondLst'), 'cond');
            const isAuto = stCond?.getAttribute('evt') !== 'onBegin' && stCond?.getAttribute('delay') !== 'indefinite';
            if (isAuto && eff.trigger === 'withPrevious') {
              autoEffects.push(eff);
              continue;
            }
          }
          clickSteps.push({ id: uid('step'), effects: [eff] });
        } else {
          clickSteps[clickSteps.length - 1].effects.push(eff);
        }
      }
    }
  }

  return { autoEffects, clickSteps };
}

function fillToCanvasStyle(
  ctx: CanvasRenderingContext2D,
  fill: PptxFill,
  x: number,
  y: number,
  w: number,
  h: number
): string | CanvasGradient | null {
  if (fill.type === 'none') return null;
  if (fill.type === 'solid') return fill.color;
  if (fill.type === 'gradient') {
    if (fill.kind === 'radial') {
      const grad = ctx.createRadialGradient(
        x + w / 2,
        y + h / 2,
        0,
        x + w / 2,
        y + h / 2,
        Math.max(w, h) * 0.7
      );
      fill.stops.forEach((s) => grad.addColorStop(s.pos / 100, s.color));
      return grad;
    }
    const rad = ((fill.angleDeg - 90) * Math.PI) / 180;
    const dx = Math.cos(rad) * (w / 2);
    const dy = Math.sin(rad) * (h / 2);
    const grad = ctx.createLinearGradient(
      x + w / 2 - dx,
      y + h / 2 - dy,
      x + w / 2 + dx,
      y + h / 2 + dy
    );
    fill.stops.forEach((s) => grad.addColorStop(s.pos / 100, s.color));
    return grad;
  }
  return null;
}

function loadImgSync(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [''];
  if (maxWidth <= 20) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

export async function renderPptxSlideToDataUrl(
  slide: PptxSlide,
  deckWidth: number,
  deckHeight: number
): Promise<string> {
  const targetW = 1280;
  const scale = targetW / deckWidth;
  const targetH = Math.round(deckHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // Base white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, deckWidth, deckHeight);

  // Slide Background
  if (slide.background.type === 'image') {
    const bgImg = await loadImgSync(slide.background.src);
    if (bgImg) ctx.drawImage(bgImg, 0, 0, deckWidth, deckHeight);
  } else {
    const bgStyle = fillToCanvasStyle(ctx, slide.background, 0, 0, deckWidth, deckHeight);
    if (bgStyle) {
      ctx.fillStyle = bgStyle;
      ctx.fillRect(0, 0, deckWidth, deckHeight);
    }
  }

  for (const el of slide.elements) {
    ctx.save();
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    if (el.rotation) {
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    if (el.kind === 'image') {
      const img = await loadImgSync(el.src);
      if (img) {
        const crop = el.crop || { l: 0, t: 0, r: 0, b: 0 };
        const sx = crop.l * img.width;
        const sy = crop.t * img.height;
        const sw = Math.max(1, img.width * (1 - crop.l - crop.r));
        const sh = Math.max(1, img.height * (1 - crop.t - crop.b));
        ctx.drawImage(img, sx, sy, sw, sh, el.x, el.y, el.width, el.height);
      }
      ctx.restore();
      continue;
    }

    if (el.kind === 'shape') {
      const fillStyle = fillToCanvasStyle(ctx, el.fill, el.x, el.y, el.width, el.height);
      if (el.fill.type === 'image') {
        const bgImg = await loadImgSync(el.fill.src);
        if (bgImg) ctx.drawImage(bgImg, el.x, el.y, el.width, el.height);
      } else if (fillStyle) {
        ctx.fillStyle = fillStyle;
        if (el.presetGeom === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(cx, cy, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          const r = el.presetGeom === 'roundRect' ? Math.min(20, Math.min(el.width, el.height) * 0.12) : 0;
          ctx.roundRect(el.x, el.y, el.width, el.height, r);
          ctx.fill();
        }
      }

      if (el.stroke) {
        ctx.strokeStyle = el.stroke.color;
        ctx.lineWidth = el.stroke.width;
        if (el.presetGeom === 'line' || el.presetGeom === 'straightConnector1') {
          ctx.beginPath();
          ctx.moveTo(el.x, el.y + el.height / 2);
          ctx.lineTo(el.x + el.width, el.y + el.height / 2);
          ctx.stroke();
        } else if (el.presetGeom === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(cx, cy, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          const r = el.presetGeom === 'roundRect' ? Math.min(20, Math.min(el.width, el.height) * 0.12) : 0;
          ctx.roundRect(el.x, el.y, el.width, el.height, r);
          ctx.stroke();
        }
      }

      // Draw text paragraphs onto snapshot canvas
      const textW = Math.max(20, el.width - el.insets.l - el.insets.r);
      let curY = el.y + el.insets.t;
      for (const p of el.paragraphs) {
        const fullText = p.runs.map((r) => r.text).join('');
        const firstRun = p.runs[0];
        const fontSize = firstRun?.fontSizePx || 20;
        const prefix = p.bulletChar ? `${p.bulletChar} ` : '';
        ctx.font = `${firstRun?.italic ? 'italic ' : ''}${firstRun?.bold ? '700' : '400'} ${fontSize}px ${firstRun?.fontFamily || '"DM Sans", sans-serif'}`;
        ctx.fillStyle = firstRun?.color || '#0F172A';
        ctx.textBaseline = 'top';
        const lines = wrapTextLines(ctx, prefix + fullText, textW - (p.marginLeftPx || 0));
        for (const line of lines) {
          const lw = ctx.measureText(line).width;
          const xPos =
            p.align === 'center'
              ? el.x + el.insets.l + (textW - lw) / 2
              : p.align === 'right'
                ? el.x + el.width - el.insets.r - lw
                : el.x + el.insets.l + (p.marginLeftPx || 0);
          ctx.fillText(line, xPos, curY);
          curY += fontSize * (p.lineHeight || 1.2);
        }
        curY += p.spaceAfterPx || 4;
      }
      ctx.restore();
      continue;
    }

    if (el.kind === 'table') {
      let yCursor = el.y;
      el.rows.forEach((row, rIdx) => {
        const rh = el.rowHeights[rIdx] || 40;
        let xCursor = el.x;
        row.forEach((cell, cIdx) => {
          const cw = el.colWidths[cIdx] || 100;
          const f = fillToCanvasStyle(ctx, cell.fill, xCursor, yCursor, cw, rh);
          if (f) {
            ctx.fillStyle = f;
            ctx.fillRect(xCursor, yCursor, cw, rh);
          }
          ctx.strokeStyle = cell.borders?.bottom?.color || '#CBD5E1';
          ctx.lineWidth = 1;
          ctx.strokeRect(xCursor, yCursor, cw, rh);
          const txt = cell.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join(' ');
          const fSize = cell.paragraphs[0]?.runs[0]?.fontSizePx || 16;
          ctx.font = `500 ${fSize}px "DM Sans", sans-serif`;
          ctx.fillStyle = cell.paragraphs[0]?.runs[0]?.color || '#0F172A';
          ctx.textBaseline = 'middle';
          ctx.fillText(txt, xCursor + 8, yCursor + rh / 2, Math.max(10, cw - 16));
          xCursor += cw;
        });
        yCursor += rh;
      });
    }

    ctx.restore();
  }

  // Keep under Firestore image limit (~330KB) for smooth sync
  const qualities = [0.85, 0.74, 0.62];
  for (const q of qualities) {
    const out = canvas.toDataURL('image/jpeg', q);
    if (out.length <= 325000) return out;
  }
  return canvas.toDataURL('image/jpeg', 0.5);
}

export async function inspectPptxFile(file: File): Promise<LoadedPptxInfo> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.ppt') && !lower.endsWith('.pptx')) {
    throw new Error(
      'Định dạng .ppt (PowerPoint 97-2003 nhị phân) chưa được hỗ trợ trực tiếp. Vui lòng lưu tệp dưới dạng .pptx rồi thử lại.'
    );
  }

  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const presEntry = zip.file('ppt/presentation.xml');
  if (!presEntry) {
    throw new Error('Tệp không phải định dạng PowerPoint (.pptx) hợp lệ.');
  }

  const presXml = await presEntry.async('text');
  const presDoc = parseXml(presXml);
  const presRoot = presDoc.documentElement;
  const presRels = await readRels(zip, 'ppt/presentation.xml');

  const sldSz = childByName(presRoot, 'sldSz');
  const slideCx = Number(sldSz?.getAttribute('cx') || 12192000); // default 16:9 (13.333 in)
  const slideCy = Number(sldSz?.getAttribute('cy') || 6858000);

  const deckWidth = PAGE_DIMENSIONS.slide16x9.width; // 1600
  const emuToPx = deckWidth / slideCx;
  const deckHeight = Math.max(400, Math.round(slideCy * emuToPx));
  // 1 pt = 12700 EMU
  const ptToPx = 12700 * emuToPx;

  // Theme resolution
  const themeColors: Record<string, string> = { ...DEFAULT_THEME_COLORS };
  let themeFontMajor = '"Plus Jakarta Sans", sans-serif';
  let themeFontMinor = '"DM Sans", sans-serif';

  const themeEntry = zip.file('ppt/theme/theme1.xml');
  if (themeEntry) {
    const themeDoc = parseXml(await themeEntry.async('text'));
    const themeRoot = themeDoc.documentElement;
    const clrScheme = findDescendants(themeRoot, 'clrScheme')[0];
    if (clrScheme) {
      for (let i = 0; i < clrScheme.children.length; i++) {
        const ch = clrScheme.children[i];
        const key = localName(ch);
        const srgb = childByName(ch, 'srgbClr')?.getAttribute('val');
        const sys = childByName(ch, 'sysClr')?.getAttribute('lastClr');
        if (srgb) themeColors[key] = `#${srgb}`;
        else if (sys) themeColors[key] = `#${sys}`;
      }
    }
    const fontScheme = findDescendants(themeRoot, 'fontScheme')[0];
    if (fontScheme) {
      const maj = findDescendants(childByName(fontScheme, 'majorFont'), 'latin')[0]?.getAttribute('typeface');
      const min = findDescendants(childByName(fontScheme, 'minorFont'), 'latin')[0]?.getAttribute('typeface');
      if (maj) themeFontMajor = maj;
      if (min) themeFontMinor = min;
    }
  }

  const mediaCache = new Map<string, string>();
  const sldIdLst = childByName(presRoot, 'sldIdLst');
  const sldIdNodes = childrenByName(sldIdLst, 'sldId');

  const slides: PptxSlide[] = [];
  let transitionCount = 0;
  let animationCount = 0;

  // Cache parsed layouts & masters
  const masterCache = new Map<
    string,
    {
      clrMap: Record<string, string>;
      bg: PptxFill | null;
      elements: PptxElement[];
      phBag: PlaceholderBag;
      rels: Map<string, string>;
    }
  >();

  const loadMaster = async (masterPath: string) => {
    if (masterCache.has(masterPath)) return masterCache.get(masterPath)!;
    const entry = zip.file(masterPath);
    const defaultClrMap: Record<string, string> = {
      bg1: 'lt1',
      tx1: 'dk1',
      bg2: 'lt2',
      tx2: 'dk2',
      accent1: 'accent1',
      accent2: 'accent2',
      accent3: 'accent3',
      accent4: 'accent4',
      accent5: 'accent5',
      accent6: 'accent6',
      hlink: 'hlink',
      folHlink: 'folHlink',
    };
    if (!entry) {
      const empty = {
        clrMap: defaultClrMap,
        bg: null,
        elements: [],
        phBag: { byIdx: new Map(), byType: new Map() },
        rels: new Map<string, string>(),
      };
      masterCache.set(masterPath, empty);
      return empty;
    }

    const doc = parseXml(await entry.async('text'));
    const root = doc.documentElement;
    const mRels = await readRels(zip, masterPath);
    const clrMapEl = childByName(root, 'clrMap');
    const clrMap = { ...defaultClrMap };
    if (clrMapEl) {
      for (const attr of Array.from(clrMapEl.attributes)) {
        clrMap[attr.name] = attr.value;
      }
    }
    const ctx: ColorContext = { themeColors, clrMap, themeFontMajor, themeFontMinor };
    const cSld = childByName(root, 'cSld');
    const bgEl = childByName(cSld, 'bg');
    const bgPr = childByName(bgEl, 'bgPr');
    let bg = await resolveFillNode(bgPr, mRels, zip, mediaCache, ctx);
    if (!bg && bgEl) {
      const bgRef = childByName(bgEl, 'bgRef');
      const refClr = resolveColorNode(bgRef, ctx);
      if (refClr) bg = { type: 'solid', color: refClr };
    }
    const spTree = childByName(cSld, 'spTree');
    const phBag = collectPlaceholderBag(spTree, ctx, emuToPx);
    const elements = await parseSpTree(spTree, mRels, zip, mediaCache, ctx, emuToPx, ptToPx, 1, undefined, true);
    const result = { clrMap, bg, elements, phBag, rels: mRels };
    masterCache.set(masterPath, result);
    return result;
  };

  for (let i = 0; i < sldIdNodes.length; i++) {
    const sldNode = sldIdNodes[i];
    const rId =
      sldNode.getAttribute('r:id') ||
      sldNode.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ||
      sldNode.getAttribute('id') ||
      '';
    const slidePath = rId ? presRels.get(rId) : undefined;
    if (!slidePath) continue;

    const slideEntry = zip.file(slidePath);
    if (!slideEntry) continue;

    const slideNum = i + 1;
    const slideDoc = parseXml(await slideEntry.async('text'));
    const slideRoot = slideDoc.documentElement;
    const slideRelsList = await readRelsWithTypes(zip, slidePath);
    const slideRels = new Map(slideRelsList.map((r) => [r.id, r.target]));

    const layoutRel = slideRelsList.find((r) => r.type.includes('slideLayout'));
    let layoutBg: PptxFill | null = null;
    let layoutElements: PptxElement[] = [];
    let phBag: PlaceholderBag = { byIdx: new Map(), byType: new Map() };
    let clrMap: Record<string, string> = {
      bg1: 'lt1',
      tx1: 'dk1',
      bg2: 'lt2',
      tx2: 'dk2',
      accent1: 'accent1',
      accent2: 'accent2',
      accent3: 'accent3',
      accent4: 'accent4',
      accent5: 'accent5',
      accent6: 'accent6',
    };
    let masterBg: PptxFill | null = null;
    let masterElements: PptxElement[] = [];
    let showLayoutMasterSp = true;

    if (layoutRel) {
      const lEntry = zip.file(layoutRel.target);
      if (lEntry) {
        const lDoc = parseXml(await lEntry.async('text'));
        const lRoot = lDoc.documentElement;
        showLayoutMasterSp = lRoot.getAttribute('showMasterSp') !== '0';
        const lRelsList = await readRelsWithTypes(zip, layoutRel.target);
        const lRels = new Map(lRelsList.map((r) => [r.id, r.target]));
        const mRel = lRelsList.find((r) => r.type.includes('slideMaster'));
        if (mRel) {
          const master = await loadMaster(mRel.target);
          clrMap = master.clrMap;
          masterBg = master.bg;
          if (showLayoutMasterSp) masterElements = master.elements;
          phBag = master.phBag;
        }
        const ctxLayout: ColorContext = { themeColors, clrMap, themeFontMajor, themeFontMinor };
        const lCSld = childByName(lRoot, 'cSld');
        const lBg = childByName(lCSld, 'bg');
        layoutBg = await resolveFillNode(childByName(lBg, 'bgPr'), lRels, zip, mediaCache, ctxLayout);
        if (!layoutBg && lBg) {
          const refClr = resolveColorNode(childByName(lBg, 'bgRef'), ctxLayout);
          if (refClr) layoutBg = { type: 'solid', color: refClr };
        }
        const lSpTree = childByName(lCSld, 'spTree');
        const layoutPh = collectPlaceholderBag(lSpTree, ctxLayout, emuToPx);
        phBag = mergePlaceholderBags(phBag, layoutPh);
        layoutElements = await parseSpTree(
          lSpTree,
          lRels,
          zip,
          mediaCache,
          ctxLayout,
          emuToPx,
          ptToPx,
          slideNum,
          phBag,
          true
        );
      }
    }

    const ctxSlide: ColorContext = { themeColors, clrMap, themeFontMajor, themeFontMinor };
    const sCSld = childByName(slideRoot, 'cSld');
    const sBg = childByName(sCSld, 'bg');
    let slideBg = await resolveFillNode(childByName(sBg, 'bgPr'), slideRels, zip, mediaCache, ctxSlide);
    if (!slideBg && sBg) {
      const refClr = resolveColorNode(childByName(sBg, 'bgRef'), ctxSlide);
      if (refClr) slideBg = { type: 'solid', color: refClr };
    }
    const background: PptxFill = slideBg || layoutBg || masterBg || { type: 'solid', color: '#FFFFFF' };

    const showMasterSpOnSlide = slideRoot.getAttribute('showMasterSp') !== '0';
    const sSpTree = childByName(sCSld, 'spTree');
    const slideElements = await parseSpTree(
      sSpTree,
      slideRels,
      zip,
      mediaCache,
      ctxSlide,
      emuToPx,
      ptToPx,
      slideNum,
      phBag,
      false
    );

    const combinedElements: PptxElement[] = [
      ...(showMasterSpOnSlide ? masterElements : []),
      ...(showMasterSpOnSlide ? layoutElements : []),
      ...slideElements,
    ];

    const transition = parseTransition(slideRoot);
    if (transition.type !== 'none') transitionCount++;

    const { autoEffects, clickSteps } = parseTiming(slideRoot);
    animationCount +=
      autoEffects.length + clickSteps.reduce((acc, s) => acc + s.effects.length, 0);

    // Speaker notes
    let notes = '';
    const notesRel = slideRelsList.find((r) => r.type.includes('notesSlide'));
    if (notesRel) {
      const nEntry = zip.file(notesRel.target);
      if (nEntry) {
        const nDoc = parseXml(await nEntry.async('text'));
        notes = findDescendants(nDoc.documentElement, 't')
          .map((t) => t.textContent || '')
          .join(' ')
          .trim();
      }
    }

    // Derive clean slide title from first non-empty text shape
    let title = `Slide ${slideNum}`;
    for (const el of slideElements) {
      if (el.kind === 'shape') {
        const text = el.paragraphs
          .map((p) => p.runs.map((r) => r.text).join(''))
          .join(' ')
          .trim();
        if (text) {
          title = text.slice(0, 48);
          break;
        }
      }
    }

    slides.push({
      id: uid('pptx_slide'),
      pageId: uid('page'),
      slideNumber: slideNum,
      title,
      background,
      elements: combinedElements,
      transition,
      autoEffects,
      clickSteps,
      notes: notes || undefined,
    });
  }

  if (slides.length === 0) {
    throw new Error('Không tìm thấy slide nào trong tệp PowerPoint này.');
  }

  const baseName = file.name.replace(/\.pptx?$/i, '').trim() || 'Bài trình chiếu PowerPoint';

  return {
    fileName: file.name,
    fileSize: file.size,
    title: baseName,
    slideCount: slides.length,
    transitionCount,
    animationCount,
    deck: {
      notebookId: uid('nb'),
      title: baseName,
      width: deckWidth,
      height: deckHeight,
      slides,
    },
  };
}

export async function buildBoardPagesFromPptx(
  deck: PptxDeck,
  slideIndices: number[],
  lockBackground: boolean,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<{ pages: BoardPage[]; filteredDeck: PptxDeck }> {
  const chosenSlides = slideIndices
    .map((n) => deck.slides[n - 1])
    .filter((s): s is PptxSlide => Boolean(s));

  const pages: BoardPage[] = [];
  const nextSlides: PptxSlide[] = [];
  const dims = PAGE_DIMENSIONS.slide16x9;

  for (let i = 0; i < chosenSlides.length; i++) {
    if (signal?.aborted) {
      throw new DOMException('Đã hủy nhập PowerPoint', 'AbortError');
    }

    const slide = chosenSlides[i];
    const pageId = uid('page');
    const dataUrl = await renderPptxSlideToDataUrl(slide, deck.width, deck.height);

    const fitScale = Math.min(dims.width / deck.width, dims.height / deck.height);
    const w = deck.width * fitScale;
    const h = deck.height * fitScale;
    const x = (dims.width - w) / 2;
    const y = (dims.height - h) / 2;

    const imgEl: ImageItem = {
      id: uid('pptximg'),
      type: 'image',
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      src: dataUrl,
      opacity: 1,
      locked: lockBackground,
    };

    pages.push({
      id: pageId,
      title: `Slide ${slide.slideNumber}`,
      template: 'blank',
      pageSize: 'slide16x9',
      gridSize: 32,
      elements: [imgEl],
    });

    nextSlides.push({
      ...slide,
      pageId,
    });

    onProgress?.(i + 1, chosenSlides.length);
  }

  return {
    pages,
    filteredDeck: {
      ...deck,
      slides: nextSlides,
    },
  };
}

import { jsPDF } from 'jspdf';
import {
  BoardElement,
  BoardPage,
  NotebookDocument,
  PAGE_DIMENSIONS,
} from '../types/inkboard';
import { getCombinedBBox, uid } from './geometry';
import {
  drawTemplatePattern,
  getTemplateColors,
  renderElement,
} from './renderer';

const DB_NAME = 'InkBoardStudioDB';
const DB_VERSION = 1;
const STORE_NOTEBOOKS = 'notebooks';
const STORE_META = 'meta';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NOTEBOOKS)) {
        db.createObjectStore(STORE_NOTEBOOKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listNotebooks(ownerScope = 'guest'): Promise<NotebookDocument[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NOTEBOOKS, 'readonly');
    const store = tx.objectStore(STORE_NOTEBOOKS);
    const req = store.getAll();
    req.onsuccess = () => {
      const list = (req.result as NotebookDocument[])
        .filter((n) => (n.ownerId || 'guest') === ownerScope)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveNotebookToDB(
  doc: NotebookDocument,
  ownerScope = 'guest'
): Promise<void> {
  const db = await openDB();
  const scopedDoc: NotebookDocument = {
    ...doc,
    ownerId: doc.ownerId || ownerScope,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NOTEBOOKS, 'readwrite');
    tx.objectStore(STORE_NOTEBOOKS).put(scopedDoc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteNotebookFromDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NOTEBOOKS, 'readwrite');
    tx.objectStore(STORE_NOTEBOOKS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLastActiveNotebookId(ownerScope = 'guest'): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get(`lastActiveId_${ownerScope}`);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function setLastActiveNotebookId(
  id: string,
  ownerScope = 'guest'
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key: `lastActiveId_${ownerScope}`, value: id });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

const DEFAULT_CUSTOM_COLORS = [
  '#274C43',
  '#FDE047',
  '#FFFFFF',
  '#0F172A',
  '#2563EB',
  '#DC2626',
  '#16A34A',
  '#9333EA',
  '#EA580C',
  '#EC4899',
];

export function loadLocalCustomColors(ownerScope = 'guest'): string[] {
  try {
    const raw = localStorage.getItem(`inkboard_custom_colors_${ownerScope}`);
    if (!raw) return DEFAULT_CUSTOM_COLORS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((c): c is string => typeof c === 'string').slice(0, 24);
    }
  } catch {
    // Ignore
  }
  return DEFAULT_CUSTOM_COLORS;
}

export function saveLocalCustomColors(colors: string[], ownerScope = 'guest'): void {
  try {
    localStorage.setItem(
      `inkboard_custom_colors_${ownerScope}`,
      JSON.stringify(colors.slice(0, 24))
    );
  } catch {
    // Ignore
  }
}

export function slugifyVietnamese(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56) || `bang-viet-${Date.now().toString(36).slice(-4)}`;
}

export function createBlankPage(
  title = 'Trang 1',
  template: BoardPage['template'] = 'greenboard',
  pageSize: BoardPage['pageSize'] = 'infinite'
): BoardPage {
  return {
    id: uid('page'),
    title,
    template,
    pageSize,
    gridSize: 32,
    elements: [],
  };
}

export function createBlankNotebook(
  title = 'Bảng viết mới',
  template: BoardPage['template'] = 'blank',
  slug?: string,
  pageSize: BoardPage['pageSize'] = 'infinite',
  ownerId?: string
): NotebookDocument {
  const page = createBlankPage('Trang 1', template, pageSize);
  return {
    id: uid('nb'),
    ownerId,
    slug,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    activePageId: page.id,
    pages: [page],
    version: 1,
  };
}

export interface FSFileHandle {
  name: string;
  createWritable(): Promise<{
    write(data: string | Blob): Promise<void>;
    close(): Promise<void>;
  }>;
}

export function isTopLevelWindow(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}

export function supportsFileSystemAccess(): boolean {
  return isTopLevelWindow() && 'showSaveFilePicker' in window;
}

export async function writeDocToFileHandle(
  handle: FSFileHandle,
  doc: NotebookDocument
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(doc, null, 2));
  await writable.close();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 10000);
}

export async function saveAsInkboardFile(
  doc: NotebookDocument,
  suggestedName?: string,
  extension: '.inkboard' | '.scrbleweb' | '.json' = '.scrbleweb'
): Promise<{ handle: FSFileHandle | null; filename: string }> {
  const safeName =
    (suggestedName || doc.title || 'BangViet')
      .replace(/[^a-zA-Z0-9\u00C0-\u1EF9 _-]/g, '_')
      .trim() || 'BangViet';
  const filename = `${safeName}${extension}`;
  const jsonText = JSON.stringify(doc, null, 2);

  // Direct synchronous browser download ensures the file immediately appears in Chrome Downloads (Ctrl+J)
  // and avoids silent File System Access write blocks on protected Desktop/OneDrive folders.
  const blob = new Blob([jsonText], {
    type: extension === '.json' ? 'application/json' : 'application/octet-stream',
  });
  downloadBlob(blob, filename);
  return { handle: null, filename };
}

export function parseInkboardJSON(raw: string): NotebookDocument {
  const cleaned = raw.replace(/^\uFEFF/, '').trim();
  const parsed = JSON.parse(cleaned) as NotebookDocument;
  if (!parsed || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
    throw new Error('Tệp bảng viết không hợp lệ hoặc bị hỏng.');
  }
  return {
    ...parsed,
    id: parsed.id || uid('nb'),
    title: parsed.title || 'Bảng viết đã nhập',
    activePageId: parsed.activePageId || parsed.pages[0].id,
    updatedAt: Date.now(),
    version: parsed.version || 1,
  };
}

async function preloadPageImages(
  elements: BoardElement[],
  imageCache: Map<string, HTMLImageElement>
): Promise<void> {
  const imgs = elements.filter((e) => e.type === 'image');
  await Promise.all(
    imgs.map(
      (item) =>
        new Promise<void>((resolve) => {
          if (item.type !== 'image') return resolve();
          const existing = imageCache.get(item.src);
          if (existing && existing.complete) return resolve();
          const img = new Image();
          img.onload = () => {
            imageCache.set(item.src, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = item.src;
        })
    )
  );
}

function getExportBounds(page: BoardPage): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (page.pageSize !== 'infinite') {
    const dims = PAGE_DIMENSIONS[page.pageSize];
    return { x: 0, y: 0, width: dims.width, height: dims.height };
  }
  const bbox = getCombinedBBox(page.elements);
  if (!bbox) {
    return { x: 0, y: 0, width: 1280, height: 720 };
  }
  const pad = 64;
  return {
    x: bbox.x - pad,
    y: bbox.y - pad,
    width: Math.max(640, bbox.width + pad * 2),
    height: Math.max(480, bbox.height + pad * 2),
  };
}

export async function renderPageToOffscreenCanvas(
  page: BoardPage,
  scale = 2,
  transparentBg = false
): Promise<HTMLCanvasElement> {
  const bounds = getExportBounds(page);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bounds.width * scale);
  canvas.height = Math.round(bounds.height * scale);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const tpl = getTemplateColors(page.template);
  if (!transparentBg) {
    ctx.fillStyle = tpl.bg;
    ctx.fillRect(0, 0, bounds.width, bounds.height);
  }

  ctx.save();
  ctx.translate(-bounds.x, -bounds.y);
  if (!transparentBg) {
    drawTemplatePattern(
      ctx,
      page.template,
      tpl.line,
      page.gridSize || 32,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height
    );
  }

  const imageCache = new Map<string, HTMLImageElement>();
  await preloadPageImages(page.elements, imageCache);
  for (const el of page.elements) {
    renderElement(ctx, el, imageCache);
  }
  ctx.restore();

  return canvas;
}

export async function exportPageToPNG(
  page: BoardPage,
  filename: string,
  transparentBg = false
) {
  const canvas = await renderPageToOffscreenCanvas(page, 2, transparentBg);
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${filename}.png`);
  }, 'image/png');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportPageToSVG(page: BoardPage, filename: string) {
  const bounds = getExportBounds(page);
  const tpl = getTemplateColors(page.template);
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" width="${bounds.width}" height="${bounds.height}">`
  );
  parts.push(
    `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${tpl.bg}" />`
  );

  const getDashAttr = (style: 'solid' | 'dashed' | 'dotted', width: number) => {
    if (style === 'dashed') {
      return `stroke-dasharray="${Math.max(8, width * 3.1)} ${Math.max(6, width * 2.1)}"`;
    }
    if (style === 'dotted') {
      return `stroke-dasharray="0.1 ${Math.max(5.5, width * 2.2)}"`;
    }
    return '';
  };

  for (const el of page.elements) {
    if (el.type === 'stroke') {
      if (el.points.length === 0) continue;
      const d = el.points
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');
      const dashAttr = getDashAttr(el.lineStyle || 'solid', el.width);
      parts.push(
        `<path d="${d}" fill="none" stroke="${el.color}" stroke-width="${el.width}" stroke-opacity="${el.opacity}" stroke-linecap="round" stroke-linejoin="round" ${dashAttr} />`
      );
    } else if (el.type === 'shape') {
      const x = el.width >= 0 ? el.x : el.x + el.width;
      const y = el.height >= 0 ? el.y : el.y + el.height;
      const w = Math.abs(el.width);
      const h = Math.abs(el.height);
      const fillAttr =
        el.fillColor && el.fillColor !== 'transparent' && el.fillOpacity > 0
          ? `fill="${el.fillColor}" fill-opacity="${el.fillOpacity}"`
          : 'fill="none"';
      const shapeStyle = el.lineStyle ?? (el.dashed ? 'dashed' : 'solid');
      const dashAttr = getDashAttr(shapeStyle, el.strokeWidth);
      const rotAttr = el.rotation
        ? `transform="rotate(${el.rotation} ${x + w / 2} ${y + h / 2})"`
        : '';

      if (el.shapeType === 'line' || el.shapeType === 'arrow' || el.shapeType === 'doubleArrow') {
        parts.push(
          `<line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="round" ${dashAttr} />`
        );
      } else if (el.shapeType === 'ellipse') {
        parts.push(
          `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" ${fillAttr} ${dashAttr} ${rotAttr} />`
        );
      } else {
        parts.push(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${el.shapeType === 'roundedRect' ? 14 : 0}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" ${fillAttr} ${dashAttr} ${rotAttr} />`
        );
      }
    } else if (el.type === 'text') {
      const lines = (el.text || '').split('\n');
      const tspans = lines
        .map(
          (l, idx) =>
            `<tspan x="${el.x + 8}" dy="${idx === 0 ? 0 : el.fontSize * 1.35}">${escapeXml(l)}</tspan>`
        )
        .join('');
      parts.push(
        `<text x="${el.x + 8}" y="${el.y + 8 + el.fontSize}" font-size="${el.fontSize}" fill="${el.color}" font-family="DM Sans, sans-serif">${tspans}</text>`
      );
    } else if (el.type === 'sticky') {
      parts.push(
        `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="6" fill="${el.noteColor}" />`
      );
      parts.push(
        `<text x="${el.x + 14}" y="${el.y + 24 + el.fontSize}" font-size="${el.fontSize}" fill="${el.textColor}" font-family="DM Sans, sans-serif">${escapeXml(el.text || '')}</text>`
      );
    } else if (el.type === 'image') {
      parts.push(
        `<image href="${escapeXml(el.src)}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" opacity="${el.opacity ?? 1}" />`
      );
    }
  }

  parts.push('</svg>');
  const blob = new Blob([parts.join('\n')], { type: 'image/svg+xml' });
  downloadBlob(blob, `${filename}.svg`);
}

export async function exportNotebookToPDF(doc: NotebookDocument) {
  let pdf: jsPDF | null = null;

  for (let i = 0; i < doc.pages.length; i++) {
    const page = doc.pages[i];
    const canvas = await renderPageToOffscreenCanvas(page, 2, false);
    const w = canvas.width;
    const h = canvas.height;
    const orientation = w >= h ? 'landscape' : 'portrait';

    if (!pdf) {
      pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [w / 2, h / 2],
        hotfixes: ['px_scaling'],
      });
    } else {
      pdf.addPage([w / 2, h / 2], orientation);
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.94);
    pdf.addImage(imgData, 'JPEG', 0, 0, w / 2, h / 2);
  }

  if (pdf) {
    const safeName = (doc.title || 'InkBoard').replace(/[^a-zA-Z0-9\u00C0-\u1EF9 _-]/g, '_');
    pdf.save(`${safeName}.pdf`);
  }
}

// --- Serverless Static URL Hash Share (Works with 0 backend server!) ---

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64u: string): Uint8Array {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export async function encodeBoardToHash(doc: NotebookDocument): Promise<string> {
  const json = JSON.stringify(doc);
  const rawBytes = new TextEncoder().encode(json);

  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(rawBytes);
    writer.close();
    const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());
    return `z.${bytesToBase64Url(compressed)}`;
  }

  return `u.${bytesToBase64Url(rawBytes)}`;
}

export async function decodeBoardFromHash(payload: string): Promise<NotebookDocument | null> {
  try {
    if (!payload) return null;
    if (payload.startsWith('z.') && typeof DecompressionStream !== 'undefined') {
      const bytes = base64UrlToBytes(payload.slice(2));
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(new Uint8Array(bytes));
      writer.close();
      const text = await new Response(ds.readable).text();
      return parseInkboardJSON(text);
    }
    if (payload.startsWith('u.')) {
      const bytes = base64UrlToBytes(payload.slice(2));
      const text = new TextDecoder().decode(bytes);
      return parseInkboardJSON(text);
    }
    return null;
  } catch {
    return null;
  }
}

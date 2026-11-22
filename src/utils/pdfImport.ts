import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { BoardPage, ImageItem, PAGE_DIMENSIONS } from '../types/inkboard';
import { uid } from './geometry';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface LoadedPdfInfo {
  fileName: string;
  fileSize: number;
  numPages: number;
  title: string;
  pdfDoc: pdfjsLib.PDFDocumentProxy;
}

export type PdfImportMode = 'newNotebook' | 'appendPages' | 'currentPage';

export function parsePageRange(input: string, maxPages: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return Array.from({ length: maxPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  const parts = trimmed.split(/[,;\s]+/);

  for (const part of parts) {
    if (!part) continue;
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);
      if (start > end) [start, end] = [end, start];
      for (let p = Math.max(1, start); p <= Math.min(maxPages, end); p++) {
        pages.add(p);
      }
    } else if (/^\d+$/.test(part)) {
      const p = parseInt(part, 10);
      if (p >= 1 && p <= maxPages) {
        pages.add(p);
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

export async function inspectPdfFile(file: File): Promise<LoadedPdfInfo> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
  });
  const pdfDoc = await loadingTask.promise;

  let metaTitle = '';
  try {
    const meta = await pdfDoc.getMetadata();
    const info = meta?.info as Record<string, unknown> | undefined;
    if (info && typeof info.Title === 'string' && info.Title.trim()) {
      metaTitle = info.Title.trim();
    }
  } catch {
    // Ignore optional PDF metadata failures
  }

  const baseName = file.name.replace(/\.pdf$/i, '').trim() || 'Tài liệu PDF';
  return {
    fileName: file.name,
    fileSize: file.size,
    numPages: pdfDoc.numPages,
    title: metaTitle || baseName,
    pdfDoc,
  };
}

function encodeCanvasUnderCloudLimit(canvas: HTMLCanvasElement): string {
  const qualities = [0.88, 0.78, 0.68, 0.56];
  for (const q of qualities) {
    const dataUrl = canvas.toDataURL('image/jpeg', q);
    if (dataUrl.length <= 335000) {
      return dataUrl;
    }
  }
  return canvas.toDataURL('image/jpeg', 0.48);
}

export interface RenderedPdfPage {
  pageNumber: number;
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  isLandscape: boolean;
}

export async function renderPdfPages(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumbers: number[],
  options?: {
    maxDim?: number;
    onProgress?: (done: number, total: number) => void;
    signal?: AbortSignal;
  }
): Promise<RenderedPdfPage[]> {
  const maxDim = options?.maxDim ?? 1420;
  const results: RenderedPdfPage[] = [];

  for (let i = 0; i < pageNumbers.length; i++) {
    if (options?.signal?.aborted) {
      throw new DOMException('Đã hủy nhập PDF', 'AbortError');
    }

    const pageNum = pageNumbers[i];
    const pdfPage = await pdfDoc.getPage(pageNum);
    const baseViewport = pdfPage.getViewport({ scale: 1 });

    const scale = Math.min(
      2.2,
      Math.max(1.0, maxDim / Math.max(baseViewport.width, baseViewport.height))
    );
    const viewport = pdfPage.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // White paper base before rendering PDF page
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await pdfPage.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    const dataUrl = encodeCanvasUnderCloudLimit(canvas);
    results.push({
      pageNumber: pageNum,
      dataUrl,
      naturalWidth: viewport.width,
      naturalHeight: viewport.height,
      isLandscape: baseViewport.width > baseViewport.height,
    });

    pdfPage.cleanup();
    options?.onProgress?.(i + 1, pageNumbers.length);
  }

  return results;
}

export function buildBoardPagesFromPdf(
  renderedPages: RenderedPdfPage[],
  lockBackground = true
): BoardPage[] {
  return renderedPages.map((rp) => {
    const pageSize = rp.isLandscape ? 'a4Landscape' : 'a4Portrait';
    const dims = PAGE_DIMENSIONS[pageSize];
    const pad = 16;
    const availW = dims.width - pad * 2;
    const availH = dims.height - pad * 2;
    const fitScale = Math.min(availW / rp.naturalWidth, availH / rp.naturalHeight);
    const w = rp.naturalWidth * fitScale;
    const h = rp.naturalHeight * fitScale;
    const x = (dims.width - w) / 2;
    const y = (dims.height - h) / 2;

    const imageEl: ImageItem = {
      id: uid('pdfimg'),
      type: 'image',
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      src: rp.dataUrl,
      opacity: 1,
      locked: lockBackground,
    };

    return {
      id: uid('page'),
      title: `Trang ${rp.pageNumber}`,
      template: 'blank',
      pageSize,
      gridSize: 32,
      elements: [imageEl],
    };
  });
}

export function buildImageElementsFromPdf(
  renderedPages: RenderedPdfPage[],
  center: { x: number; y: number },
  lockBackground = false
): ImageItem[] {
  const items: ImageItem[] = [];
  let cursorY = center.y - 360;

  for (const rp of renderedPages) {
    const targetW = rp.isLandscape ? 920 : 720;
    const scale = targetW / rp.naturalWidth;
    const w = targetW;
    const h = rp.naturalHeight * scale;

    items.push({
      id: uid('pdfimg'),
      type: 'image',
      x: center.x - w / 2,
      y: cursorY,
      width: w,
      height: h,
      rotation: 0,
      src: rp.dataUrl,
      opacity: 1,
      locked: lockBackground,
    });

    cursorY += h + 28;
  }

  return items;
}

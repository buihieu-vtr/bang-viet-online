import React, { useEffect, useRef, useState } from 'react';
import { FilePlus2, FileText, Trash2, X } from 'lucide-react';
import { BoardPage, PAGE_DIMENSIONS } from '../types/inkboard';
import { drawTemplatePattern, getTemplateColors, renderElement } from '../utils/renderer';

interface PageTocSidebarProps {
  open: boolean;
  onClose: () => void;
  pages: BoardPage[];
  activePageId: string;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
  onSwitchAllToA4: () => void;
}

const PageThumbnailCanvas: React.FC<{ page: BoardPage }> = ({ page }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [thumbTick, setThumbTick] = useState(0);

  const dims =
    page.pageSize === 'infinite'
      ? { width: 1120, height: 1584 }
      : PAGE_DIMENSIONS[page.pageSize];

  const thumbW = 148;
  const thumbH = Math.round((dims.height / dims.width) * thumbW);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(thumbW * dpr);
    canvas.height = Math.round(thumbH * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = thumbW / dims.width;
    ctx.save();
    ctx.scale(dpr, dpr);

    const tpl = getTemplateColors(page.template);
    ctx.fillStyle = tpl.bg;
    ctx.fillRect(0, 0, thumbW, thumbH);

    ctx.save();
    ctx.scale(scale, scale);
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

    for (const el of page.elements) {
      renderElement(ctx, el, imageCacheRef.current, () => {
        setThumbTick((t) => t + 1);
      });
    }
    ctx.restore();
    ctx.restore();
  }, [page, dims.width, dims.height, thumbW, thumbH, thumbTick]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: thumbW, height: thumbH }}
      className="block rounded-xs bg-white"
    />
  );
};

export const PageTocSidebar: React.FC<PageTocSidebarProps> = ({
  open,
  onClose,
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onDeletePage,
  onSwitchAllToA4,
}) => {
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!open) return;
    const el = itemRefs.current[activePageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [open, activePageId]);

  if (!open) return null;

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];
  const isInfinite = activePage?.pageSize === 'infinite';

  return (
    <>
      <div
        onClick={onClose}
        className="md:hidden absolute inset-0 bg-slate-950/35 z-30"
      />
      <aside className="absolute inset-y-0 left-0 md:static w-60 max-w-[82vw] h-full bg-white dark:bg-[#161920] border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 select-none z-40 md:z-30 shadow-xl md:shadow-xs">
        {/* Header matching clean Document Outline / Mục lục */}
        <div className="h-12 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
            Mục lục
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onAddPage}
              title="Thêm trang mới"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Đóng mục lục"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isInfinite && (
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-blue-50/70 dark:bg-blue-950/30">
            <button
              type="button"
              onClick={onSwitchAllToA4}
              className="w-full py-2 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Chuyển khổ A4 để lướt trang</span>
            </button>
          </div>
        )}

        {/* Scrollable Thumbnail Stack */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {pages.map((p, idx) => {
            const isCurrent = p.id === activePageId;
            return (
              <div
                key={p.id}
                ref={(node) => {
                  itemRefs.current[p.id] = node;
                }}
                onClick={() => onSelectPage(p.id)}
                className="group flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <div
                  className={`relative rounded-sm transition-all p-[2px] ${
                    isCurrent
                      ? 'ring-2 ring-blue-600 bg-blue-600 shadow-md'
                      : 'border border-slate-200 dark:border-slate-700 hover:border-slate-400 shadow-xs'
                  }`}
                >
                  <PageThumbnailCanvas page={p} />
                  {pages.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePage(p.id);
                      }}
                      title="Xóa trang"
                      className="flex md:hidden md:group-hover:flex absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-white/95 dark:bg-slate-900/95 text-rose-600 shadow items-center justify-center hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span
                  className={`text-xs font-mono-tabular ${
                    isCurrent
                      ? 'font-bold text-blue-600 dark:text-blue-400'
                      : 'font-medium text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {idx + 1}
                </span>
              </div>
            );
          })}

          <button
            type="button"
            onClick={onAddPage}
            className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 text-xs font-medium text-slate-500 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            Thêm trang mới
          </button>
        </div>
      </aside>
    </>
  );
};

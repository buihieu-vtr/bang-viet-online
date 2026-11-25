import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookPlus,
  FilePlus2,
  Lock,
  Play,
  Presentation,
  Unlock,
  X,
} from 'lucide-react';
import { parsePageRange } from '../utils/pdfImport';
import { LoadedPptxInfo, PptxImportMode } from '../utils/pptxImport';

interface PptxImportModalProps {
  open: boolean;
  pptxInfo: LoadedPptxInfo | null;
  onClose: () => void;
  onConfirmImport: (options: {
    mode: PptxImportMode;
    slideNumbers: number[];
    lockBackground: boolean;
    notebookTitle: string;
    startSlideshowAfter: boolean;
    onProgress: (done: number, total: number) => void;
    signal: AbortSignal;
  }) => Promise<void>;
}

export const PptxImportModal: React.FC<PptxImportModalProps> = ({
  open,
  pptxInfo,
  onClose,
  onConfirmImport,
}) => {
  const [mode, setMode] = useState<PptxImportMode>('newNotebook');
  const [rangeType, setRangeType] = useState<'all' | 'custom'>('all');
  const [rangeText, setRangeText] = useState('1-10');
  const [lockBackground, setLockBackground] = useState(true);
  const [startSlideshowAfter, setStartSlideshowAfter] = useState(true);
  const [notebookTitle, setNotebookTitle] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open && pptxInfo) {
      setMode('newNotebook');
      setRangeType('all');
      setRangeText(`1-${Math.min(15, pptxInfo.slideCount)}`);
      setLockBackground(true);
      setStartSlideshowAfter(true);
      setNotebookTitle(pptxInfo.title);
      setImporting(false);
      setProgress({ done: 0, total: 0 });
      setErrorMsg(null);
    }
  }, [open, pptxInfo]);

  const selectedSlides = useMemo(() => {
    if (!pptxInfo) return [];
    if (rangeType === 'all') {
      return Array.from({ length: pptxInfo.slideCount }, (_, i) => i + 1);
    }
    return parsePageRange(rangeText, pptxInfo.slideCount);
  }, [pptxInfo, rangeType, rangeText]);

  if (!open || !pptxInfo) return null;

  const sizeMb = (pptxInfo.fileSize / (1024 * 1024)).toFixed(2);

  const handleCancel = () => {
    if (importing) {
      abortRef.current?.abort();
      setImporting(false);
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSlides.length === 0) {
      setErrorMsg('Phạm vi slide không hợp lệ. Ví dụ hợp lệ: 1-5 hoặc 1,3,5.');
      return;
    }

    setErrorMsg(null);
    setImporting(true);
    setProgress({ done: 0, total: selectedSlides.length });
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await onConfirmImport({
        mode,
        slideNumbers: selectedSlides,
        lockBackground,
        notebookTitle: notebookTitle.trim() || pptxInfo.title,
        startSlideshowAfter,
        onProgress: (done, total) => setProgress({ done, total }),
        signal: controller.signal,
      });
      setImporting(false);
      onClose();
    } catch (err) {
      setImporting(false);
      if ((err as Error)?.name === 'AbortError') return;
      setErrorMsg(
        (err as Error)?.message ||
          'Không thể xử lý tệp PowerPoint này. Vui lòng kiểm tra lại định dạng .pptx.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#161920] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Presentation className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                Nhập bài giảng PowerPoint (.pptx)
              </h2>
              <p className="text-[11px] text-slate-500 truncate font-mono-tabular">
                {pptxInfo.fileName} · {pptxInfo.slideCount} slide · {pptxInfo.animationCount} hiệu ứng · {pptxInfo.transitionCount} chuyển cảnh · {sizeMb} MB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Import Mode */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">
              Cách nhập vào bảng viết
            </label>
            <div className="space-y-1.5">
              {(
                [
                  {
                    id: 'newNotebook',
                    title: 'Tạo bài trình chiếu mới (Khuyên dùng)',
                    desc: 'Giữ nguyên toàn bộ hiệu ứng xuất hiện, chuyển cảnh & viết trực tiếp lên slide',
                    icon: <BookPlus className="w-4 h-4 text-orange-600 shrink-0" />,
                  },
                  {
                    id: 'appendPages',
                    title: 'Nối thêm các slide vào bảng đang mở',
                    desc: 'Thêm các slide PowerPoint vào cuối danh sách trang hiện tại',
                    icon: <FilePlus2 className="w-4 h-4 text-emerald-600 shrink-0" />,
                  },
                ] as const
              ).map((opt) => {
                const active = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={importing}
                    onClick={() => setMode(opt.id)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                      active
                        ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="mt-0.5">{opt.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {opt.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {mode === 'newNotebook' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">
                Tên bài giảng mới
              </label>
              <input
                type="text"
                disabled={importing}
                value={notebookTitle}
                onChange={(e) => setNotebookTitle(e.target.value)}
                placeholder="Nhập tên bài giảng..."
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          )}

          {/* Slide Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Chọn slide nhập
              </label>
              <span className="text-[11px] font-mono-tabular text-slate-500">
                Sẽ nhập {selectedSlides.length} / {pptxInfo.slideCount} slide
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                disabled={importing}
                onClick={() => setRangeType('all')}
                className={`py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  rangeType === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Tất cả ({pptxInfo.slideCount} slide)
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={() => setRangeType('custom')}
                className={`py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  rangeType === 'custom'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Tùy chọn slide
              </button>
            </div>

            {rangeType === 'custom' && (
              <div className="space-y-1">
                <input
                  type="text"
                  disabled={importing}
                  value={rangeText}
                  onChange={(e) => setRangeText(e.target.value)}
                  placeholder="Ví dụ: 1-5, 8, 10-12"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono-tabular text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 cursor-pointer">
              <div className="flex items-center gap-2 min-w-0">
                <Play className="w-4 h-4 text-orange-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Mở ngay chế độ Trình chiếu PowerPoint + Viết bảng
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Trình chiếu toàn màn hình, giữ nguyên hiệu ứng và viết trực tiếp lên slide
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                disabled={importing}
                checked={startSlideshowAfter}
                onChange={(e) => setStartSlideshowAfter(e.target.checked)}
                className="accent-orange-600 w-4 h-4 shrink-0 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 cursor-pointer">
              <div className="flex items-center gap-2 min-w-0">
                {lockBackground ? (
                  <Lock className="w-4 h-4 text-blue-600 shrink-0" />
                ) : (
                  <Unlock className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Cố định nền slide ở chế độ bảng thường
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Tẩy hoặc khoanh chọn mực viết tay không làm lệch slide gốc
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                disabled={importing}
                checked={lockBackground}
                onChange={(e) => setLockBackground(e.target.checked)}
                className="accent-blue-600 w-4 h-4 shrink-0 cursor-pointer"
              />
            </label>
          </div>

          {importing && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-medium text-orange-600 dark:text-orange-400">
                <span>Đang dựng slide &amp; hiệu ứng PowerPoint...</span>
                <span className="font-mono-tabular">
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-orange-600 transition-all duration-150"
                  style={{
                    width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleCancel}
              className="h-9 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {importing ? 'Hủy nhập' : 'Đóng'}
            </button>
            <button
              type="submit"
              disabled={importing || selectedSlides.length === 0}
              className="h-9 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              {importing
                ? `Đang nhập (${progress.done}/${progress.total})...`
                : `Nhập ${selectedSlides.length} slide`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

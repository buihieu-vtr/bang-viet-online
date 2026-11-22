import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookPlus,
  FilePlus2,
  FileText,
  Image as ImageIcon,
  Lock,
  Unlock,
  X,
} from 'lucide-react';
import {
  LoadedPdfInfo,
  parsePageRange,
  PdfImportMode,
} from '../utils/pdfImport';

interface PdfImportModalProps {
  open: boolean;
  pdfInfo: LoadedPdfInfo | null;
  onClose: () => void;
  onConfirmImport: (options: {
    mode: PdfImportMode;
    pageNumbers: number[];
    lockBackground: boolean;
    notebookTitle: string;
    onProgress: (done: number, total: number) => void;
    signal: AbortSignal;
  }) => Promise<void>;
}

export const PdfImportModal: React.FC<PdfImportModalProps> = ({
  open,
  pdfInfo,
  onClose,
  onConfirmImport,
}) => {
  const [mode, setMode] = useState<PdfImportMode>('newNotebook');
  const [rangeType, setRangeType] = useState<'all' | 'custom'>('all');
  const [rangeText, setRangeText] = useState('1-10');
  const [lockBackground, setLockBackground] = useState(true);
  const [notebookTitle, setNotebookTitle] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open && pdfInfo) {
      setMode('newNotebook');
      setRangeType('all');
      setRangeText(`1-${Math.min(10, pdfInfo.numPages)}`);
      setLockBackground(true);
      setNotebookTitle(pdfInfo.title);
      setImporting(false);
      setProgress({ done: 0, total: 0 });
      setErrorMsg(null);
    }
  }, [open, pdfInfo]);

  const selectedPages = useMemo(() => {
    if (!pdfInfo) return [];
    if (rangeType === 'all') {
      return Array.from({ length: pdfInfo.numPages }, (_, i) => i + 1);
    }
    return parsePageRange(rangeText, pdfInfo.numPages);
  }, [pdfInfo, rangeType, rangeText]);

  if (!open || !pdfInfo) return null;

  const sizeMb = (pdfInfo.fileSize / (1024 * 1024)).toFixed(2);

  const handleCancel = () => {
    if (importing) {
      abortRef.current?.abort();
      setImporting(false);
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPages.length === 0) {
      setErrorMsg('Phạm vi trang không hợp lệ. Ví dụ hợp lệ: 1-5 hoặc 1,3,5.');
      return;
    }

    setErrorMsg(null);
    setImporting(true);
    setProgress({ done: 0, total: selectedPages.length });
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await onConfirmImport({
        mode,
        pageNumbers: selectedPages,
        lockBackground,
        notebookTitle: notebookTitle.trim() || pdfInfo.title,
        onProgress: (done, total) => setProgress({ done, total }),
        signal: controller.signal,
      });
      setImporting(false);
      onClose();
    } catch (err) {
      setImporting(false);
      if ((err as Error)?.name === 'AbortError') {
        return;
      }
      setErrorMsg(
        'Không thể xử lý tệp PDF này. Tệp có thể bị hỏng hoặc được bảo vệ bằng mật khẩu.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#161920] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                Nhập tài liệu PDF
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                {pdfInfo.fileName} · {pdfInfo.numPages} trang · {sizeMb} MB
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
                    title: 'Tạo bảng viết PDF mới (Khuyên dùng)',
                    desc: 'Mỗi trang PDF thành 1 trang A4 có Mục lục lướt trang & viết lên trên',
                    icon: <BookPlus className="w-4 h-4 text-blue-600 shrink-0" />,
                  },
                  {
                    id: 'appendPages',
                    title: 'Thêm thành các trang mới vào bảng hiện tại',
                    desc: 'Giữ nguyên trang đang có và nối thêm các trang PDF vào cuối',
                    icon: <FilePlus2 className="w-4 h-4 text-emerald-600 shrink-0" />,
                  },
                  {
                    id: 'currentPage',
                    title: 'Chèn thành hình ảnh trên trang đang mở',
                    desc: 'Đặt trang PDF lên bảng hiện tại để tự do di chuyển, phóng to/thu nhỏ',
                    icon: <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />,
                  },
                ] as const
              ).map((opt) => {
                const active = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={importing}
                    onClick={() => {
                      setMode(opt.id);
                      setLockBackground(opt.id !== 'currentPage');
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                      active
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/35'
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
                Tên bảng viết mới
              </label>
              <input
                type="text"
                disabled={importing}
                value={notebookTitle}
                onChange={(e) => setNotebookTitle(e.target.value)}
                placeholder="Nhập tên tài liệu..."
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}

          {/* Page Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Chọn trang nhập
              </label>
              <span className="text-[11px] font-mono-tabular text-slate-500">
                Sẽ nhập {selectedPages.length} / {pdfInfo.numPages} trang
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
                Tất cả ({pdfInfo.numPages} trang)
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
                Tùy chọn trang
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
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono-tabular text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
                />
                <p className="text-[11px] text-slate-400">
                  Nhập số trang hoặc khoảng trang cách nhau bởi dấu phẩy (vd: 1-10, 15).
                </p>
              </div>
            )}
          </div>

          {/* Lock Background Toggle */}
          <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 cursor-pointer">
            <div className="flex items-center gap-2 min-w-0">
              {lockBackground ? (
                <Lock className="w-4 h-4 text-blue-600 shrink-0" />
              ) : (
                <Unlock className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Cố định trang PDF làm nền viết
                </div>
                <div className="text-[11px] text-slate-500">
                  Khi tẩy hoặc khoanh chọn chữ viết tay sẽ không làm xê dịch trang PDF
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

          {importing && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-medium text-blue-600 dark:text-blue-400">
                <span>Đang chuyển trang PDF sang bảng viết...</span>
                <span className="font-mono-tabular">
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-150"
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
              disabled={importing || selectedPages.length === 0}
              className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              {importing
                ? `Đang nhập (${progress.done}/${progress.total})...`
                : `Nhập ${selectedPages.length} trang PDF`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

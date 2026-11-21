import React, { useEffect, useState } from 'react';
import {
  CopyPlus,
  Download,
  FileImage,
  FileText,
  Globe,
  HardDriveDownload,
  SaveAll,
  X,
} from 'lucide-react';

interface SaveAsModalProps {
  open: boolean;
  onClose: () => void;
  currentTitle: string;
  onOpenWebLink: () => void;
  onSaveAsCopyInLibrary: (newTitle: string) => void;
  onSaveAsDiskFile: (newTitle: string, ext: '.inkboard' | '.scrbleweb' | '.json') => void;
  onExportPNG: (transparent: boolean) => void;
  onExportSVG: () => void;
  onExportPDF: () => void;
}

export const SaveAsModal: React.FC<SaveAsModalProps> = ({
  open,
  onClose,
  currentTitle,
  onOpenWebLink,
  onSaveAsCopyInLibrary,
  onSaveAsDiskFile,
  onExportPNG,
  onExportSVG,
  onExportPDF,
}) => {
  const [name, setName] = useState(currentTitle);
  const [ext, setExt] = useState<'.scrbleweb' | '.inkboard' | '.json'>('.scrbleweb');

  useEffect(() => {
    if (open) setName(currentTitle);
  }, [open, currentTitle]);

  if (!open) return null;

  const cleanName = name.trim() || currentTitle;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#161920] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SaveAll className="w-5 h-5 text-blue-600" />
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
              Lưu thành & Chia sẻ Link Web
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Web Link CTA */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenWebLink();
            }}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center justify-between cursor-pointer transition-colors shadow-xs"
          >
            <span className="flex items-center gap-2.5">
              <Globe className="w-4 h-4" />
              Tạo Link Web chia sẻ (Không cần Server)
            </span>
            <span className="font-mono-tabular opacity-90">#ten=...</span>
          </button>

          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Tên tệp / Bản sao cục bộ
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên bảng viết..."
                className="flex-1 h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
              />
              <select
                value={ext}
                onChange={(e) => setExt(e.target.value as '.scrbleweb' | '.inkboard' | '.json')}
                className="h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono-tabular text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value=".scrbleweb">.scrbleweb</option>
                <option value=".inkboard">.inkboard</option>
                <option value=".json">.json</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                onSaveAsDiskFile(cleanName, ext);
                onClose();
              }}
              className="w-full py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center justify-between cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <HardDriveDownload className="w-4 h-4 text-blue-600" />
                Tải tệp dự án về máy (mở lại làm tiếp)
              </span>
              <span className="font-mono-tabular text-slate-400">{ext}</span>
            </button>
            <p className="text-[11px] text-slate-500 leading-relaxed px-1">
              Tệp sẽ tự lưu vào thư mục <strong>Downloads (Tải xuống)</strong> (bấm <code className="font-mono-tabular">Ctrl+J</code> để mở nhanh). Nếu xem trong khung nhúng không thấy tải, hãy mở web ở tab trình duyệt riêng.
            </p>

            <button
              type="button"
              onClick={() => {
                onSaveAsCopyInLibrary(cleanName);
                onClose();
              }}
              className="w-full py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center justify-between cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <CopyPlus className="w-4 h-4 text-slate-500" />
                Lưu bản sao mới vào Sổ tay trình duyệt
              </span>
              <span className="text-[11px] text-slate-400">IndexedDB</span>
            </button>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400">
              Xuất hình ảnh & Tài liệu chia sẻ
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onExportPNG(false);
                  onClose();
                }}
                className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
              >
                <FileImage className="w-4 h-4 text-blue-500" />
                Ảnh PNG (2x)
              </button>

              <button
                type="button"
                onClick={() => {
                  onExportPNG(true);
                  onClose();
                }}
                className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
              >
                <FileImage className="w-4 h-4 text-emerald-500" />
                PNG Trong suốt
              </button>

              <button
                type="button"
                onClick={() => {
                  onExportSVG();
                  onClose();
                }}
                className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-amber-500" />
                Vector SVG
              </button>

              <button
                type="button"
                onClick={() => {
                  onExportPDF();
                  onClose();
                }}
                className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-rose-500" />
                PDF Nhiều trang
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

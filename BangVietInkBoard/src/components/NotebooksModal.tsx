import React, { useState } from 'react';
import {
  BookOpen,
  Copy,
  FilePlus,
  FolderOpen,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { NotebookDocument } from '../types/inkboard';

interface NotebooksModalProps {
  open: boolean;
  onClose: () => void;
  notebooks: NotebookDocument[];
  activeId: string;
  onSelectNotebook: (doc: NotebookDocument) => void;
  onCreateNotebook: () => void;
  onDuplicateNotebook: (doc: NotebookDocument) => void;
  onDeleteNotebook: (id: string) => void;
  onImportFile: () => void;
}

export const NotebooksModal: React.FC<NotebooksModalProps> = ({
  open,
  onClose,
  notebooks,
  activeId,
  onSelectNotebook,
  onCreateNotebook,
  onDuplicateNotebook,
  onDeleteNotebook,
  onImportFile,
}) => {
  const [query, setQuery] = useState('');

  if (!open) return null;

  const filtered = notebooks.filter((nb) =>
    nb.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#161920] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
              Thư viện Bảng viết (Lưu trữ cục bộ)
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

        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm sổ tay..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onImportFile}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Mở tệp .inkboard
            </button>
            <button
              type="button"
              onClick={onCreateNotebook}
              className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5" />
              Tạo bảng mới
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Không tìm thấy bảng viết nào phù hợp.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((nb) => {
                const isActive = nb.id === activeId;
                const totalElements = nb.pages.reduce(
                  (acc, p) => acc + p.elements.length,
                  0
                );
                return (
                  <div
                    key={nb.id}
                    onClick={() => {
                      onSelectNotebook(nb);
                      onClose();
                    }}
                    className={`group p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      isActive
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {nb.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
                          {nb.pages.length} trang · {totalElements} nét/hình
                        </div>
                      </div>
                      {isActive && (
                        <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 shrink-0">
                          Đang mở
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="text-[11px] text-slate-400 font-mono-tabular">
                        {new Date(nb.updatedAt).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onDuplicateNotebook(nb)}
                          title="Nhân bản"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {notebooks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteNotebook(nb.id)}
                            title="Xóa bảng viết"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/60 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

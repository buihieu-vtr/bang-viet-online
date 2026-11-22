import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  FilePlus2,
  Lock,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import {
  BoardPage,
  PAGE_DIMENSIONS,
  PageSizeMode,
  PAPER_TEMPLATES,
  PaperTemplate,
} from '../types/inkboard';

interface PagesDrawerProps {
  open: boolean;
  onClose: () => void;
  pages: BoardPage[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onDuplicatePage: (id: string) => void;
  onDeletePage: (id: string) => void;
  onMovePage: (id: string, dir: -1 | 1) => void;
  onChangeTemplate: (tpl: PaperTemplate) => void;
  onChangePageSize: (size: PageSizeMode) => void;
  onChangeGridSize: (gridSize: number) => void;
  onToggleLockImages?: () => void;
}

export const PagesDrawer: React.FC<PagesDrawerProps> = ({
  open,
  onClose,
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
  onChangeTemplate,
  onChangePageSize,
  onChangeGridSize,
  onToggleLockImages,
}) => {
  if (!open) return null;

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];
  const hasImages = activePage.elements.some((el) => el.type === 'image');
  const hasLockedImages = activePage.elements.some((el) => el.type === 'image' && el.locked);

  return (
    <>
      <div
        onClick={onClose}
        className="md:hidden absolute inset-0 bg-slate-950/35 z-30"
      />
      <aside className="absolute inset-y-0 right-0 md:static w-72 max-w-[85vw] h-full bg-white dark:bg-[#161920] border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 select-none z-40 md:z-30 shadow-xl md:shadow-none">
        <div className="h-12 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
            Trang & Mẫu giấy
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Paper Template Section */}
        <section className="space-y-2.5">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Nền bảng & Mẫu giấy
          </div>
          <div className="grid grid-cols-4 gap-2">
            {PAPER_TEMPLATES.map((tpl) => {
              const selected = activePage.template === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onChangeTemplate(tpl.id)}
                  title={tpl.label}
                  className={`group flex flex-col items-center gap-1 cursor-pointer`}
                >
                  <div
                    className={`w-full h-11 rounded-lg border transition-all relative overflow-hidden ${
                      selected
                        ? 'ring-2 ring-blue-600 border-blue-600'
                        : 'border-slate-300 dark:border-slate-700 group-hover:border-slate-400'
                    }`}
                    style={{ backgroundColor: tpl.bg }}
                  >
                    {tpl.id === 'ruled' && (
                      <div className="absolute inset-0 flex flex-col justify-evenly px-1 opacity-55">
                        <div className="h-px bg-slate-400" />
                        <div className="h-px bg-slate-400" />
                        <div className="h-px bg-slate-400" />
                      </div>
                    )}
                    {(tpl.id === 'grid' ||
                      tpl.id === 'greenboard' ||
                      tpl.id === 'greenboard_grid') && (
                      <div
                        className="absolute inset-0 opacity-50"
                        style={{
                          backgroundImage:
                            tpl.id === 'grid'
                              ? 'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)'
                              : 'linear-gradient(to right, rgba(255,255,255,0.38) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.38) 1px, transparent 1px)',
                          backgroundSize: '8px 8px',
                        }}
                      />
                    )}
                    {tpl.id === 'greenboard_grid' && (
                      <div className="absolute inset-y-0 left-1/2 w-[1.5px] bg-yellow-400/75" />
                    )}
                    {tpl.id === 'dots' && (
                      <div
                        className="absolute inset-0 opacity-60"
                        style={{
                          backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)',
                          backgroundSize: '8px 8px',
                        }}
                      />
                    )}
                    {tpl.id === 'music' && (
                      <div className="absolute inset-0 flex flex-col justify-center gap-1 px-1 opacity-60">
                        <div className="h-px bg-slate-500" />
                        <div className="h-px bg-slate-500" />
                        <div className="h-px bg-slate-500" />
                        <div className="h-px bg-slate-500" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-full">
                    {tpl.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Page Size & Grid Density */}
        <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Kích thước trang
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { id: 'infinite', label: 'Bảng vô hạn' },
                { id: 'slide16x9', label: PAGE_DIMENSIONS.slide16x9.label },
                { id: 'a4Portrait', label: PAGE_DIMENSIONS.a4Portrait.label },
                { id: 'a4Landscape', label: PAGE_DIMENSIONS.a4Landscape.label },
              ] as { id: PageSizeMode; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangePageSize(item.id)}
                className={`py-2 px-2.5 rounded-lg text-[11px] font-medium border text-left transition-colors cursor-pointer ${
                  activePage.pageSize === item.id
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {(activePage.template === 'grid' ||
            activePage.template === 'ruled' ||
            activePage.template === 'dots') && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Khoảng cách ô / dòng</span>
                <span className="font-mono-tabular">{activePage.gridSize} px</span>
              </div>
              <input
                type="range"
                min={20}
                max={64}
                step={2}
                value={activePage.gridSize}
                onChange={(e) => onChangeGridSize(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          )}
          {hasImages && onToggleLockImages && (
            <button
              type="button"
              onClick={onToggleLockImages}
              className="w-full py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                {hasLockedImages ? (
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-slate-500" />
                )}
                {hasLockedImages ? 'Đang khóa nền PDF/ảnh' : 'Khóa ảnh làm nền viết'}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400">
                {hasLockedImages ? 'Mở khóa' : 'Khóa'}
              </span>
            </button>
          )}
        </section>

        {/* Pages List */}
        <section className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Danh sách trang ({pages.length})
            </span>
            <button
              type="button"
              onClick={onAddPage}
              className="h-7 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              Thêm trang
            </button>
          </div>

          <div className="space-y-2">
            {pages.map((p, idx) => {
              const isCurrent = p.id === activePageId;
              const tpl = PAPER_TEMPLATES.find((t) => t.id === p.template) ?? PAPER_TEMPLATES[0];
              return (
                <div
                  key={p.id}
                  onClick={() => onSelectPage(p.id)}
                  className={`group p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isCurrent
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-10 h-7 rounded-md border border-slate-300 dark:border-slate-700 shrink-0 flex items-center justify-center text-[10px] font-mono-tabular font-semibold"
                      style={{
                        backgroundColor: tpl.bg,
                        color: tpl.dark ? '#E2E8F0' : '#334155',
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {p.title || `Trang ${idx + 1}`}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-tabular">
                        {p.elements.length} đối tượng
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onMovePage(p.id, -1)}
                      title="Lên"
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === pages.length - 1}
                      onClick={() => onMovePage(p.id, 1)}
                      title="Xuống"
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicatePage(p.id)}
                      title="Nhân bản trang"
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {pages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeletePage(p.id)}
                        title="Xóa trang"
                        className="w-6 h-6 rounded flex items-center justify-center text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/60 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
    </>
  );
};

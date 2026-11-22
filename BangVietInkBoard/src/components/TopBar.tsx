import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  BookOpen,
  ChevronDown,
  Download,
  FileImage,
  FilePlus,
  FileText,
  FolderOpen,
  Globe,
  HelpCircle,
  Layers,
  Maximize2,
  Minimize2,
  Moon,
  Palette,
  PanelLeft,
  PenLine,
  Redo2,
  Ruler,
  Save,
  SaveAll,
  Shapes,
  Smartphone,
  Sun,
  Undo2,
  User as UserIcon,
} from 'lucide-react';
import { PaperTemplate, PenSlot, ToolType } from '../types/inkboard';
import { ColorPalettePicker } from './ColorPalettePicker';

interface TopBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  penSlots: PenSlot[];
  activeSlotId: string;
  activeTool: ToolType;
  onSelectPenSlot: (slot: PenSlot) => void;
  onUpdatePenSlot: (slot: PenSlot) => void;
  inkToShape: boolean;
  onToggleInkToShape: () => void;
  rulerVisible: boolean;
  onToggleRuler: () => void;
  stylusOnly: boolean;
  onToggleStylusOnly: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  pagesDrawerOpen: boolean;
  onTogglePagesDrawer: () => void;
  pageIndex: number;
  pageCount: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenLibrary: () => void;
  onNewNotebook: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onOpenSaveAs: () => void;
  onOpenWebLink: () => void;
  onOpenHelp: () => void;
  activeSlug: string | null;
  activeTemplate: PaperTemplate;
  onQuickSwitchBoard: (tpl: PaperTemplate) => void;
  onExportPNG: (transparent: boolean) => void;
  onExportSVG: () => void;
  onExportPDF: () => void;
  saveStatus: 'saved' | 'saving';
  linkedFileName: string | null;
  tocOpen: boolean;
  onToggleToc: () => void;
  user: User | null;
  onOpenAuth: () => void;
  customColors: string[];
  onAddCustomColor: (hex: string) => void;
  onRemoveCustomColor: (hex: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onTitleChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  penSlots,
  activeSlotId,
  activeTool,
  onSelectPenSlot,
  onUpdatePenSlot,
  inkToShape,
  onToggleInkToShape,
  rulerVisible,
  onToggleRuler,
  stylusOnly,
  onToggleStylusOnly,
  darkMode,
  onToggleDarkMode,
  pagesDrawerOpen,
  onTogglePagesDrawer,
  pageIndex,
  pageCount,
  isFullscreen,
  onToggleFullscreen,
  onOpenLibrary,
  onNewNotebook,
  onOpenFile,
  onSave,
  onOpenSaveAs,
  onOpenWebLink,
  onOpenHelp,
  activeSlug,
  activeTemplate,
  onQuickSwitchBoard,
  onExportPNG,
  onExportSVG,
  onExportPDF,
  saveStatus,
  linkedFileName,
  tocOpen,
  onToggleToc,
  user,
  onOpenAuth,
  customColors,
  onAddCustomColor,
  onRemoveCustomColor,
}) => {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [quickColorOpen, setQuickColorOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const slotEditorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
      if (slotEditorRef.current && !slotEditorRef.current.contains(e.target as Node)) {
        setEditingSlotId(null);
        setQuickColorOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isInkToolActive =
    activeTool === 'pen' || activeTool === 'pencil' || activeTool === 'highlighter';
  const currentActiveSlot = penSlots.find((s) => s.id === activeSlotId) || penSlots[0];

  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== title) {
      onTitleChange(trimmed);
    } else {
      setDraftTitle(title);
    }
  };

  const editingSlot = penSlots.find((s) => s.id === editingSlotId) || null;
  const isGreenboard = activeTemplate === 'greenboard' || activeTemplate === 'greenboard_grid';
  const isChalkboard = activeTemplate === 'chalkboard';

  return (
    <header className="relative z-40 h-14 px-2.5 flex items-center justify-between gap-2 bg-white/95 dark:bg-[#161920]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 select-none shrink-0">
      {/* Zone 1: Brand + Mục lục + File Menu + Document Title + Undo/Redo */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="flex items-center gap-1.5 pr-1.5 border-r border-slate-200 dark:border-slate-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <PenLine className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap hidden min-[1720px]:inline">
            InkBoard
          </span>
        </div>

        {/* Mục lục (A4 Outline Sidebar Toggle) */}
        <button
          type="button"
          onClick={onToggleToc}
          title="Mục lục trang A4 (xem trước & lướt nhanh)"
          className={`h-8 px-2 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            tocOpen
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <PanelLeft className="w-4 h-4" />
          <span className="hidden xl:inline">Mục lục</span>
        </button>

        {/* File Menu */}
        <div className="relative shrink-0" ref={fileMenuRef}>
          <button
            type="button"
            onClick={() => setFileMenuOpen((v) => !v)}
            className="h-8 px-2 rounded-lg flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Tệp</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>

          {fileMenuOpen && (
            <div className="absolute left-0 top-11 w-68 rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-50">
              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  onNewNotebook();
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FilePlus className="w-4 h-4 text-slate-500" />
                  Bảng viết mới
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  onOpenWebLink();
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4" />
                  Tạo Link Web chia sẻ (#board)
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  onOpenFile();
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FolderOpen className="w-4 h-4 text-slate-500" />
                  Mở tệp (.scrbleweb / .inkboard)...
                </span>
                <span className="text-[11px] font-mono-tabular text-slate-400">Ctrl+O</span>
              </button>

              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  onSave();
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Save className="w-4 h-4 text-blue-600" />
                  {linkedFileName ? `Lưu (${linkedFileName})` : 'Lưu ngay'}
                </span>
                <span className="text-[11px] font-mono-tabular text-slate-400">Ctrl+S</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  onOpenSaveAs();
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <SaveAll className="w-4 h-4 text-slate-500" />
                  Lưu thành... (Save As)
                </span>
                <span className="text-[11px] font-mono-tabular text-slate-400">Ctrl+Shift+S</span>
              </button>

              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

              <div className="px-3.5 py-1 text-[11px] font-medium text-slate-400">
                Xuất định dạng khác
              </div>

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  onExportPNG(false);
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
              >
                <FileImage className="w-4 h-4 text-slate-500" />
                Xuất ảnh PNG (2x sắc nét)
              </button>

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  onExportPNG(true);
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
              >
                <FileImage className="w-4 h-4 text-slate-500" />
                Xuất PNG nền trong suốt
              </button>

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  onExportSVG();
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-500" />
                Xuất Vector SVG
              </button>

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  onExportPDF();
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-rose-500" />
                Xuất PDF toàn bộ trang
              </button>
            </div>
          )}
        </div>

        {/* Editable Title */}
        <div className="hidden 2xl:flex items-center gap-1.5 shrink-0">
          {editingTitle ? (
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') {
                  setDraftTitle(title);
                  setEditingTitle(false);
                }
              }}
              className="h-8 px-2 text-xs font-medium rounded-md border border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none w-32"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              title="Nhấn để đổi tên bảng viết"
              className="h-8 px-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 truncate max-w-[120px] cursor-pointer"
            >
              {title}
            </button>
          )}
          <span className="text-[11px] text-slate-400 whitespace-nowrap">
            {saveStatus === 'saving' ? 'Đang lưu...' : 'Đã lưu'}
          </span>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 pl-1 border-l border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            title="Hoàn tác (Ctrl+Z)"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            title="Làm lại (Ctrl+Y)"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Zone 2: Quick Pen Slots + Quick Board Switcher + Ruler */}
      <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/70 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 relative shrink-0" ref={slotEditorRef}>
        {penSlots.map((slot) => {
          const selected = isInkToolActive && activeSlotId === slot.id;
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => {
                setQuickColorOpen(false);
                if (selected) {
                  setEditingSlotId((prev) => (prev === slot.id ? null : slot.id));
                } else {
                  onSelectPenSlot(slot);
                  setEditingSlotId(null);
                }
              }}
              title={`${slot.label} (${slot.width}px) — Nhấn lần nữa để tùy chỉnh`}
              className={`relative h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                selected
                  ? 'bg-white dark:bg-slate-900 shadow-xs ring-2 ring-blue-600'
                  : 'hover:bg-white/60 dark:hover:bg-slate-700/60'
              }`}
            >
              {slot.tool === 'highlighter' ? (
                <span
                  className="w-4 h-4 rounded-xs border border-black/15"
                  style={{ backgroundColor: slot.color, opacity: 0.8 }}
                />
              ) : (
                <span
                  className="rounded-full border border-black/20 dark:border-white/25"
                  style={{
                    backgroundColor: slot.color,
                    width: `${Math.min(18, Math.max(7, slot.width * 1.9))}px`,
                    height: `${Math.min(18, Math.max(7, slot.width * 1.9))}px`,
                  }}
                />
              )}
              {slot.tool === 'pencil' && (
                <span className="absolute -bottom-0.5 right-0.5 text-[8px] font-bold text-slate-500">
                  P
                </span>
              )}
            </button>
          );
        })}

        {/* Quick Custom Color Strip Trigger */}
        <button
          type="button"
          onClick={() => {
            setEditingSlotId(null);
            setQuickColorOpen((v) => !v);
          }}
          title="Dải màu tự chọn cho bút đang dùng"
          className={`h-8 px-2 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            quickColorOpen
              ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs ring-2 ring-blue-600'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70'
          }`}
        >
          <span
            className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/25 shrink-0"
            style={{ backgroundColor: currentActiveSlot.color }}
          />
          <Palette className="w-3.5 h-3.5" />
          <span className="hidden 2xl:inline">Dải màu</span>
        </button>

        <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* Quick 1-click Board Surface Switcher: Whiteboard vs Realistic Greenboard vs Chalkboard */}
        <div className="hidden lg:flex items-center gap-0.5 bg-white/60 dark:bg-slate-900/60 p-0.5 rounded-lg border border-slate-200/70 dark:border-slate-700/70 shrink-0">
          <button
            type="button"
            onClick={() => onQuickSwitchBoard('blank')}
            title="Bảng trắng từ tính"
            className={`h-7 px-1.5 2xl:px-2 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
              !isGreenboard && !isChalkboard
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="w-3 h-3 rounded-xs bg-white border border-slate-300" />
            <span className="hidden min-[1720px]:inline">Trắng</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickSwitchBoard('greenboard')}
            title="Bảng xanh RAL 180 30 15 (#274C43) có lưới trắng nhạt"
            className={`h-7 px-1.5 min-[1720px]:px-2 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
              isGreenboard
                ? 'bg-[#274C43] text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="w-3 h-3 rounded-xs bg-[#274C43] border border-white/25" />
            <span className="hidden min-[1720px]:inline">Bảng xanh</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickSwitchBoard('chalkboard')}
            title="Bảng đen phấn"
            className={`h-7 px-1.5 min-[1720px]:px-2 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
              isChalkboard
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="w-3 h-3 rounded-xs bg-[#1B2027] border border-white/25" />
            <span className="hidden min-[1720px]:inline">Đen</span>
          </button>
        </div>

        {/* Ink-to-Shape Toggle */}
        <button
          type="button"
          onClick={onToggleInkToShape}
          title="Nhận diện hình tự động (Vẽ tay thành hình học)"
          className={`h-8 px-2 rounded-lg flex items-center gap-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            inkToShape
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70'
          }`}
        >
          <Shapes className="w-3.5 h-3.5" />
          <span className="hidden min-[1720px]:inline">Tự nắn</span>
        </button>

        {/* Interactive Ruler Toggle */}
        <button
          type="button"
          onClick={onToggleRuler}
          title="Thước kẻ từ tính"
          className={`h-8 px-2 rounded-lg flex items-center gap-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            rulerVisible
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          <span className="hidden min-[1720px]:inline">Thước</span>
        </button>

        {/* Quick Custom Color Strip Popover */}
        {quickColorOpen && (
          <div className="absolute top-12 left-0 w-76 rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-xl p-3.5 z-50">
            <ColorPalettePicker
              label={`Màu bút (${currentActiveSlot.label})`}
              color={currentActiveSlot.color}
              onChange={(hex) =>
                onUpdatePenSlot({ ...currentActiveSlot, color: hex })
              }
              customColors={customColors}
              onAddCustomColor={onAddCustomColor}
              onRemoveCustomColor={onRemoveCustomColor}
            />
          </div>
        )}

        {/* Pen Slot Customizer Popover */}
        {editingSlot && (
          <div className="absolute top-12 left-0 w-76 rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-xl p-3.5 z-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Tùy chỉnh: {editingSlot.label}
              </span>
              <span className="text-[11px] font-mono-tabular text-slate-500">
                {editingSlot.width}px
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 mb-3">
              {(
                [
                  { id: 'pen', label: 'Bút mực' },
                  { id: 'pencil', label: 'Chì / Phấn' },
                  { id: 'highlighter', label: 'Dạ quang' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    onUpdatePenSlot({
                      ...editingSlot,
                      tool: t.id,
                      opacity: t.id === 'highlighter' ? 0.42 : t.id === 'pencil' ? 0.94 : 1,
                      width:
                        t.id === 'highlighter'
                          ? Math.max(14, editingSlot.width)
                          : Math.min(18, editingSlot.width),
                    })
                  }
                  className={`py-1.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                    editingSlot.tool === t.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mb-3">
              <ColorPalettePicker
                color={editingSlot.color}
                onChange={(hex) => onUpdatePenSlot({ ...editingSlot, color: hex })}
                customColors={customColors}
                onAddCustomColor={onAddCustomColor}
                onRemoveCustomColor={onRemoveCustomColor}
              />
            </div>

            <div className="space-y-1.5 mb-2.5">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Độ dày nét</span>
                <span className="font-mono-tabular">{editingSlot.width} px</span>
              </div>
              <input
                type="range"
                min={1}
                max={editingSlot.tool === 'highlighter' ? 48 : 28}
                step={0.5}
                value={editingSlot.width}
                onChange={(e) =>
                  onUpdatePenSlot({ ...editingSlot, width: parseFloat(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Độ mờ đục</span>
                <span className="font-mono-tabular">
                  {Math.round(editingSlot.opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.15}
                max={1}
                step={0.05}
                value={editingSlot.opacity}
                onChange={(e) =>
                  onUpdatePenSlot({ ...editingSlot, opacity: parseFloat(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Zone 3: Palm Rejection, Library, Pages, Web Link, Theme, Fullscreen */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onToggleStylusOnly}
          title={
            stylusOnly
              ? 'Chế độ Chỉ Bút đang BẬT (chặn cảm ứng tay để chống tì tay)'
              : 'Chế độ Chỉ Bút đang TẮT'
          }
          className={`h-8 px-2 rounded-lg flex items-center gap-1 text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            stylusOnly
              ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
              : 'border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden min-[1720px]:inline">
            {stylusOnly ? 'Chỉ bút' : 'Tay & Bút'}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenLibrary}
          title="Sổ tay cục bộ"
          className="h-8 px-2 rounded-lg flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden 2xl:inline">Sổ tay</span>
        </button>

        <button
          type="button"
          onClick={onTogglePagesDrawer}
          title="Quản lý trang & Mẫu bảng"
          className={`h-8 px-2 rounded-lg flex items-center gap-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            pagesDrawerOpen
              ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="font-mono-tabular">
            {pageIndex + 1}/{pageCount}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenWebLink}
          title="Tạo Link Web chia sẻ & Tên miền riêng (Không cần Server)"
          className={`h-8 px-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeSlug
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden xl:inline font-mono-tabular max-w-[96px] truncate">
            {activeSlug ? `#${activeSlug}` : 'Link Web'}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenSaveAs}
          title="Lưu thành / Xuất PDF, PNG, SVG"
          className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden 2xl:inline">Xuất</span>
        </button>

        <button
          type="button"
          onClick={onOpenAuth}
          title={
            user
              ? `Tài khoản: ${user.displayName || user.email} — Nhấn để quản lý / đăng xuất`
              : 'Đăng nhập / Đăng ký để tách biệt dữ liệu người dùng'
          }
          className={`h-8 px-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
            user
              ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/70'
              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-4 h-4 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserIcon className="w-3.5 h-3.5" />
          )}
          <span className="hidden xl:inline max-w-[84px] truncate">
            {user ? user.displayName || user.email?.split('@')[0] || 'Tài khoản' : 'Đăng nhập'}
          </span>
          {user && (
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                user.emailVerified ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenHelp}
          title="Hướng dẫn dùng Web, tải về & chạy tên miền riêng"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          title={darkMode ? 'Giao diện sáng' : 'Giao diện tối'}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình / Trình chiếu'}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer hidden sm:flex"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
};

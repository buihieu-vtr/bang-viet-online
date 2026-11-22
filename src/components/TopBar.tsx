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
  MoreHorizontal,
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
import { PaperTemplate, PenSlot, StrokeStyle, ToolType } from '../types/inkboard';
import { ColorPalettePicker } from './ColorPalettePicker';

const StrokePreviewSvg: React.FC<{
  style: StrokeStyle;
  color: string;
  strokeWidth?: number;
  className?: string;
}> = ({ style, color, strokeWidth = 2.5, className = 'w-5 h-3' }) => {
  const dash =
    style === 'dashed'
      ? '5 3.5'
      : style === 'dotted'
        ? '0.1 4.5'
        : undefined;
  return (
    <svg viewBox="0 0 26 10" className={className} aria-hidden="true">
      <line
        x1="2"
        y1="5"
        x2="24"
        y2="5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  );
};

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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [quickColorOpen, setQuickColorOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const slotEditorRef = useRef<HTMLDivElement>(null);
  const mobileSlotEditorRef = useRef<HTMLDivElement>(null);
  const slotPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (fileMenuRef.current && !fileMenuRef.current.contains(target)) {
        setFileMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setMoreMenuOpen(false);
      }
      const inDesktopSlots = slotEditorRef.current?.contains(target);
      const inMobileSlots = mobileSlotEditorRef.current?.contains(target);
      const inPopover = slotPopoverRef.current?.contains(target);
      if (!inDesktopSlots && !inMobileSlots && !inPopover) {
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

  const renderPenControls = (compactMobile: boolean) => (
    <>
      {penSlots.map((slot) => {
        const selected = isInkToolActive && activeSlotId === slot.id;
        const slotStyle: StrokeStyle = slot.lineStyle || 'solid';
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
            title={`${slot.label} (${slot.width}px${slotStyle === 'dashed' ? ', nét đứt' : slotStyle === 'dotted' ? ', nét chấm' : ''}) — Nhấn lần nữa để tùy chỉnh`}
            className={`relative h-8 w-7.5 xl:w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 ${
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
                  width: `${Math.min(18, Math.max(6, slot.width * 1.85))}px`,
                  height: `${Math.min(18, Math.max(6, slot.width * 1.85))}px`,
                }}
              />
            )}
            {slot.tool === 'pencil' && (
              <span className="absolute -bottom-0.5 right-0.5 text-[8px] font-bold text-slate-500">
                P
              </span>
            )}
            {slotStyle !== 'solid' && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 pointer-events-none">
                {slotStyle === 'dashed' ? (
                  <>
                    <span className="w-1.5 h-[2px] rounded-full bg-slate-600 dark:bg-slate-300" />
                    <span className="w-1.5 h-[2px] rounded-full bg-slate-600 dark:bg-slate-300" />
                  </>
                ) : (
                  <>
                    <span className="w-[2px] h-[2px] rounded-full bg-slate-600 dark:bg-slate-300" />
                    <span className="w-[2px] h-[2px] rounded-full bg-slate-600 dark:bg-slate-300" />
                    <span className="w-[2px] h-[2px] rounded-full bg-slate-600 dark:bg-slate-300" />
                  </>
                )}
              </span>
            )}
          </button>
        );
      })}

      {/* Quick Stroke Width & Line Style Trigger (Always visible!) */}
      <button
        type="button"
        onClick={() => {
          setQuickColorOpen(false);
          setEditingSlotId((prev) =>
            prev === currentActiveSlot.id ? null : currentActiveSlot.id
          );
        }}
        title="Chế độ nét: chỉnh nét liền / nét đứt / nét chấm & độ dày to nhỏ tùy chỉnh"
        className={`h-8 px-1.5 xl:px-2 rounded-lg flex items-center gap-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          editingSlotId === currentActiveSlot.id
            ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs ring-2 ring-blue-600'
            : 'text-slate-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-700/70'
        }`}
      >
        <StrokePreviewSvg
          style={currentActiveSlot.lineStyle || 'solid'}
          color={currentActiveSlot.color}
          strokeWidth={Math.min(4.2, Math.max(1.5, currentActiveSlot.width * 0.42))}
          className="w-5 h-2.5 shrink-0"
        />
        <span className="font-mono-tabular text-[11px]">
          {currentActiveSlot.width}px
        </span>
      </button>

      {/* Quick Custom Color Strip Trigger */}
      <button
        type="button"
        onClick={() => {
          setEditingSlotId(null);
          setQuickColorOpen((v) => !v);
        }}
        title="Dải màu tự chọn cho bút đang dùng"
        className={`h-8 px-1.5 xl:px-2 rounded-lg flex items-center gap-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
        <span className={compactMobile ? 'inline' : 'hidden 2xl:inline'}>Dải màu</span>
      </button>

      <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

      {/* Quick 1-click Board Surface Switcher */}
      <div className="flex items-center gap-0.5 bg-white/60 dark:bg-slate-900/60 p-0.5 rounded-lg border border-slate-200/70 dark:border-slate-700/70 shrink-0">
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
          <span className="w-3 h-3 rounded-xs bg-white border border-slate-300 shrink-0" />
          <span className={compactMobile ? 'inline' : 'hidden min-[1720px]:inline'}>Trắng</span>
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
          <span className="w-3 h-3 rounded-xs bg-[#274C43] border border-white/25 shrink-0" />
          <span className={compactMobile ? 'inline' : 'hidden min-[1720px]:inline'}>Xanh</span>
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
          <span className="w-3 h-3 rounded-xs bg-[#1B2027] border border-white/25 shrink-0" />
          <span className={compactMobile ? 'inline' : 'hidden min-[1720px]:inline'}>Đen</span>
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
        <span className={compactMobile ? 'inline' : 'hidden min-[1720px]:inline'}>Tự nắn</span>
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
        <span className={compactMobile ? 'inline' : 'hidden min-[1720px]:inline'}>Thước</span>
      </button>
    </>
  );

  return (
    <header className="relative z-40 px-2 lg:px-2.5 bg-white/95 dark:bg-[#161920]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 select-none shrink-0">
      {/* Main Row (Row 1 on Mobile/Tablet, Full Single Bar on Desktop >= lg) */}
      <div className="h-11 lg:h-14 flex items-center justify-between gap-1.5 lg:gap-2">
        {/* Zone 1: Brand + Mục lục + File Menu + Document Title + Undo/Redo */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 pr-1.5 border-r border-slate-200 dark:border-slate-800 shrink-0">
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
              <div className="fixed left-2 right-2 top-12 sm:absolute sm:left-0 sm:right-auto sm:top-11 sm:w-68 max-h-[calc(100dvh-64px)] overflow-y-auto rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-50">
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

      {/* Zone 2 (Desktop >= lg): Quick Pen Slots + Quick Board Switcher + Ruler */}
      <div
        className="hidden lg:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/70 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 relative shrink-0"
        ref={slotEditorRef}
      >
        {renderPenControls(false)}
      </div>

      {/* Zone 3: Palm Rejection, Library, Pages, Web Link, Auth, More (Mobile), Theme, Fullscreen */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onToggleStylusOnly}
          title={
            stylusOnly
              ? 'Chế độ Chỉ Bút đang BẬT (chặn cảm ứng tay để chống tì tay)'
              : 'Chế độ Chỉ Bút đang TẮT'
          }
          className={`hidden lg:flex h-8 px-2 rounded-lg items-center gap-1 text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
          className="hidden sm:flex h-8 px-2 rounded-lg items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
          className={`hidden sm:flex h-8 px-2 rounded-lg text-xs font-medium items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
          className="hidden lg:flex h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
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
          <span className="hidden sm:inline max-w-[84px] truncate">
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

        {/* Mobile/Tablet Overflow Menu (< lg) */}
        <div className="relative lg:hidden shrink-0" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => setMoreMenuOpen((v) => !v)}
            title="Thêm tùy chọn"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              moreMenuOpen
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {moreMenuOpen && (
            <div className="fixed right-2 top-12 w-60 max-h-[calc(100dvh-64px)] overflow-y-auto rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-50">
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenLibrary();
                }}
                className="sm:hidden w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-slate-500" />
                Sổ tay cục bộ
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenWebLink();
                }}
                className="sm:hidden w-full px-3.5 py-2.5 text-left text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-2.5 cursor-pointer"
              >
                <Globe className="w-4 h-4" />
                {activeSlug ? `Link Web (#${activeSlug})` : 'Tạo Link Web chia sẻ'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenSaveAs();
                }}
                className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
              >
                <Save className="w-4 h-4 text-blue-600" />
                Xuất PDF / PNG / SVG...
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleStylusOnly();
                }}
                className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-slate-500" />
                  Chế độ Chỉ Bút (Chống tì tay)
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    stylusOnly
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                      : 'text-slate-400'
                  }`}
                >
                  {stylusOnly ? 'BẬT' : 'TẮT'}
                </span>
              </button>

              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

              <button
                type="button"
                onClick={() => {
                  onToggleDarkMode();
                  setMoreMenuOpen(false);
                }}
                className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
              >
                {darkMode ? (
                  <Sun className="w-4 h-4 text-amber-500" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-500" />
                )}
                {darkMode ? 'Chuyển giao diện Sáng' : 'Chuyển giao diện Tối'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenHelp();
                }}
                className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-slate-500" />
                Hướng dẫn dùng Web
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onToggleFullscreen();
                }}
                className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4 text-slate-500" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-slate-500" />
                )}
                {isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenHelp}
          title="Hướng dẫn dùng Web, tải về & chạy tên miền riêng"
          className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          title={darkMode ? 'Giao diện sáng' : 'Giao diện tối'}
          className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình / Trình chiếu'}
          className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </div>
      </div>

      {/* Mobile / Tablet Row 2 (< lg): Horizontally Scrollable Pen Slots, Color Strip, Boards, Auto-Shape & Ruler */}
      <div
        ref={mobileSlotEditorRef}
        className="flex lg:hidden items-center gap-1 h-10 -mx-2 px-2 border-t border-slate-200/70 dark:border-slate-800/70 overflow-x-auto no-scrollbar"
      >
        {renderPenControls(true)}
      </div>

      {/* Viewport-Safe Floating Popovers (never clipped by overflow-x-auto or narrow screens) */}
      {(quickColorOpen || editingSlot) && (
        <div
          ref={slotPopoverRef}
          className="fixed inset-x-3 top-[88px] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 lg:top-14 sm:w-80 max-h-[calc(100dvh-104px)] overflow-y-auto rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-2xl p-3.5 z-50"
        >
          {quickColorOpen && (
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
          )}

          {editingSlot && (
            <>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Tùy chỉnh nét: {editingSlot.label}
                </span>
                <span className="text-[11px] font-mono-tabular text-slate-500">
                  {editingSlot.width}px ·{' '}
                  {(editingSlot.lineStyle || 'solid') === 'dashed'
                    ? 'Nét đứt'
                    : (editingSlot.lineStyle || 'solid') === 'dotted'
                      ? 'Nét chấm'
                      : 'Nét liền'}
                </span>
              </div>

              {/* Live Stroke Preview */}
              <div
                className={`h-11 rounded-lg border border-slate-200 dark:border-slate-700 mb-3 flex items-center justify-center px-3 ${
                  isGreenboard
                    ? 'bg-[#274C43]'
                    : isChalkboard
                      ? 'bg-[#1B2027]'
                      : 'bg-slate-50 dark:bg-slate-900'
                }`}
              >
                <svg viewBox="0 0 240 36" className="w-full h-8 overflow-visible">
                  <path
                    d="M 10 22 Q 65 6 120 18 T 230 15"
                    fill="none"
                    stroke={editingSlot.color}
                    strokeOpacity={editingSlot.opacity}
                    strokeWidth={Math.min(22, Math.max(0.8, editingSlot.width))}
                    strokeLinecap={
                      (editingSlot.lineStyle || 'solid') === 'dotted'
                        ? 'round'
                        : editingSlot.tool === 'highlighter'
                          ? 'butt'
                          : 'round'
                    }
                    strokeDasharray={
                      (editingSlot.lineStyle || 'solid') === 'dashed'
                        ? `${Math.max(8, editingSlot.width * 3.1)} ${Math.max(6, editingSlot.width * 2.1)}`
                        : (editingSlot.lineStyle || 'solid') === 'dotted'
                          ? `0.1 ${Math.max(5.5, editingSlot.width * 2.2)}`
                          : undefined
                    }
                  />
                </svg>
              </div>

              {/* Pen Type */}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 mb-2.5">
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

              {/* Line Style Selector (Solid / Dashed / Dotted) */}
              <div className="mb-3">
                <div className="text-[11px] text-slate-500 mb-1.5">Kiểu nét vẽ</div>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {(
                    [
                      { id: 'solid', label: 'Nét liền' },
                      { id: 'dashed', label: 'Nét đứt' },
                      { id: 'dotted', label: 'Nét chấm' },
                    ] as const
                  ).map((st) => {
                    const active = (editingSlot.lineStyle || 'solid') === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() =>
                          onUpdatePenSlot({ ...editingSlot, lineStyle: st.id })
                        }
                        className={`py-1.5 px-1.5 rounded-md flex flex-col items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <StrokePreviewSvg
                          style={st.id}
                          color={active ? '#2563EB' : 'currentColor'}
                          strokeWidth={2.4}
                          className="w-7 h-2.5"
                        />
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Size Presets + Fine Thickness Slider */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Độ dày nét (To / Nhỏ)</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdatePenSlot({
                          ...editingSlot,
                          width: Math.max(0.5, Number((editingSlot.width - 0.5).toFixed(1))),
                        })
                      }
                      className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center cursor-pointer"
                      title="Giảm 0.5px"
                    >
                      -
                    </button>
                    <span className="font-mono-tabular font-semibold text-slate-800 dark:text-slate-100 min-w-[40px] text-center">
                      {editingSlot.width} px
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdatePenSlot({
                          ...editingSlot,
                          width: Math.min(
                            editingSlot.tool === 'highlighter' ? 48 : 28,
                            Number((editingSlot.width + 0.5).toFixed(1))
                          ),
                        })
                      }
                      className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center cursor-pointer"
                      title="Tăng 0.5px"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 5 Quick Presets */}
                <div className="grid grid-cols-5 gap-1">
                  {(editingSlot.tool === 'highlighter'
                    ? [10, 16, 22, 30, 40]
                    : [1.5, 3, 5, 8, 14]
                  ).map((preset) => {
                    const isPresetActive = Math.abs(editingSlot.width - preset) < 0.25;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          onUpdatePenSlot({ ...editingSlot, width: preset })
                        }
                        className={`h-8 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                          isPresetActive
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className="rounded-full bg-current"
                          style={{
                            width: `${Math.min(13, Math.max(3, preset * (editingSlot.tool === 'highlighter' ? 0.28 : 0.85)))}px`,
                            height: `${Math.min(13, Math.max(3, preset * (editingSlot.tool === 'highlighter' ? 0.28 : 0.85)))}px`,
                          }}
                        />
                        <span className="text-[9px] font-mono-tabular leading-none">
                          {preset}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <input
                  type="range"
                  min={0.5}
                  max={editingSlot.tool === 'highlighter' ? 48 : 28}
                  step={0.5}
                  value={editingSlot.width}
                  onChange={(e) =>
                    onUpdatePenSlot({ ...editingSlot, width: parseFloat(e.target.value) })
                  }
                  className="w-full accent-blue-600 cursor-pointer"
                />
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
            </>
          )}
        </div>
      )}
    </header>
  );
};

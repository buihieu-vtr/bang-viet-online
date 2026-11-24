import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
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
import { PaperTemplate, PenSlot, StrokeStyle, StylusSettings, ToolType } from '../types/inkboard';
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
  stylusSettings: StylusSettings;
  onUpdateStylusSettings: (next: StylusSettings) => void;
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
  onImportPdf: () => void;
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
  stylusSettings,
  onUpdateStylusSettings,
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
  onImportPdf,
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
  const [stylusMenuOpen, setStylusMenuOpen] = useState(false);
  const [livePenInfo, setLivePenInfo] = useState<{ pressure: number; buttons: number; pointerType: string } | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [quickColorOpen, setQuickColorOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [toolsExpanded, setToolsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('inkboard_topbar_expanded');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const stylusMenuRef = useRef<HTMLDivElement>(null);
  const stylusPopoverRef = useRef<HTMLDivElement>(null);
  const slotEditorRef = useRef<HTMLDivElement>(null);
  const slotPopoverRef = useRef<HTMLDivElement>(null);

  const toggleToolsExpanded = () => {
    setToolsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('inkboard_topbar_expanded', String(next));
      } catch {
        // Ignore storage error
      }
      if (!next) {
        setEditingSlotId(null);
        setQuickColorOpen(false);
      }
      return next;
    });
  };

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  useEffect(() => {
    if (!stylusMenuOpen) {
      setLivePenInfo(null);
      return;
    }
    const onProbe = (e: PointerEvent) => {
      setLivePenInfo({
        pressure: e.pressure || 0,
        buttons: e.buttons || 0,
        pointerType: e.pointerType || 'mouse',
      });
    };
    window.addEventListener('pointerdown', onProbe);
    window.addEventListener('pointermove', onProbe);
    window.addEventListener('pointerup', onProbe);
    return () => {
      window.removeEventListener('pointerdown', onProbe);
      window.removeEventListener('pointermove', onProbe);
      window.removeEventListener('pointerup', onProbe);
    };
  }, [stylusMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (fileMenuRef.current && !fileMenuRef.current.contains(target)) {
        setFileMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setMoreMenuOpen(false);
      }
      const inStylusBtn = stylusMenuRef.current?.contains(target);
      const inStylusPop = stylusPopoverRef.current?.contains(target);
      if (!inStylusBtn && !inStylusPop) {
        setStylusMenuOpen(false);
      }
      const inSlots = slotEditorRef.current?.contains(target);
      const inPopover = slotPopoverRef.current?.contains(target);
      if (!inSlots && !inPopover) {
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
        <span className={compactMobile ? 'inline' : 'hidden sm:inline'}>Dải màu</span>
      </button>

      <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

      {/* Quick 1-click Board Surface Switcher */}
      <div className="flex items-center gap-0.5 bg-white/70 dark:bg-slate-900/70 p-0.5 rounded-lg border border-slate-200/70 dark:border-slate-700/70 shrink-0">
        <button
          type="button"
          onClick={() => onQuickSwitchBoard('blank')}
          title="Bảng trắng từ tính"
          className={`h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
            !isGreenboard && !isChalkboard
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span className="w-3 h-3 rounded-xs bg-white border border-slate-300 shrink-0" />
          <span className={compactMobile ? 'inline' : 'hidden sm:inline'}>Trắng</span>
        </button>
        <button
          type="button"
          onClick={() => onQuickSwitchBoard('greenboard')}
          title="Bảng xanh RAL 180 30 15 (#274C43) có lưới trắng nhạt"
          className={`h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
            isGreenboard
              ? 'bg-[#274C43] text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span className="w-3 h-3 rounded-xs bg-[#274C43] border border-white/25 shrink-0" />
          <span className={compactMobile ? 'inline' : 'hidden sm:inline'}>Xanh</span>
        </button>
        <button
          type="button"
          onClick={() => onQuickSwitchBoard('chalkboard')}
          title="Bảng đen phấn"
          className={`h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
            isChalkboard
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span className="w-3 h-3 rounded-xs bg-[#1B2027] border border-white/25 shrink-0" />
          <span className={compactMobile ? 'inline' : 'hidden sm:inline'}>Đen</span>
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
        <span className={compactMobile ? 'inline' : 'hidden sm:inline'}>Tự nắn</span>
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
        <span className={compactMobile ? 'inline' : 'hidden sm:inline'}>Thước</span>
      </button>
    </>
  );

  return (
    <header className="relative z-40 px-2 lg:px-3 bg-white/95 dark:bg-[#161920]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 select-none shrink-0">
      {/* Row 1: Primary Compact Bar (File, Title, History, Expand Toggle, Workspace & Account Actions) */}
      <div className="h-11 flex items-center justify-between gap-1.5">
        {/* Zone 1: Brand + Mục lục + File Menu + Document Title + Undo/Redo */}
        <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
          <div className="hidden sm:flex items-center gap-1.5 pr-1.5 border-r border-slate-200 dark:border-slate-800 shrink-0">
            <div className="w-7.5 h-7.5 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <PenLine className="w-4 h-4" />
            </div>
            <span className="font-display font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap hidden xl:inline">
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
            <span className="hidden lg:inline">Mục lục</span>
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

              <button
                type="button"
                onClick={() => {
                  setFileMenuOpen(false);
                  onImportPdf();
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-rose-500" />
                  Nhập tài liệu PDF (.pdf)...
                </span>
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
        <div className="hidden lg:flex items-center gap-1 min-w-0">
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
              className="h-8 px-2 text-xs font-medium rounded-md border border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none w-36"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              title="Nhấn để đổi tên bảng viết"
              className="h-8 px-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 truncate max-w-[140px] cursor-pointer"
            >
              {title}
            </button>
          )}
          <span className="hidden lg:inline text-[11px] text-slate-400 whitespace-nowrap">
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

        {/* Expand/Collapse Toggle for Row 2 (Pen presets, Colors, Board switch, Ruler) */}
        <button
          type="button"
          onClick={toggleToolsExpanded}
          title={toolsExpanded ? 'Thu gọn dòng công cụ bút & bảng' : 'Mở rộng dòng công cụ bút & bảng'}
          className={`h-8 px-2 rounded-lg border flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            toolsExpanded
              ? 'border-blue-200 dark:border-blue-800/70 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span
            className="w-2.5 h-2.5 rounded-full border border-black/20 dark:border-white/25 shrink-0"
            style={{ backgroundColor: currentActiveSlot.color }}
          />
          <span className="hidden lg:inline">Bút & Bảng</span>
          <span className="font-mono-tabular text-[10px] opacity-80">
            {currentActiveSlot.width}px
          </span>
          {toolsExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Zone 3: Stylus/Gaomon Calibration + Library, Pages, Web Link, Export, Auth, More, Theme, Fullscreen */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="hidden md:block relative shrink-0" ref={stylusMenuRef}>
          <button
            type="button"
            onClick={() => {
              setEditingSlotId(null);
              setQuickColorOpen(false);
              setStylusMenuOpen((v) => !v);
            }}
            title="Cài đặt Bảng vẽ & Bút (Chống nhận nét khi chưa chạm bảng Gaomon, Chống tì tay)"
            className={`flex h-8 px-2 rounded-lg items-center gap-1 text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              stylusSettings.stylusOnly || stylusSettings.activationThreshold > 0
                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                : 'border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">
              {stylusSettings.stylusOnly ? 'Chỉ bút' : 'Bảng vẽ'}
            </span>
            {stylusSettings.activationThreshold > 0 && (
              <span className="text-[10px] font-mono-tabular px-1 py-0.2 rounded bg-amber-200/70 dark:bg-amber-900/70">
                {Math.round(stylusSettings.activationThreshold * 100)}%
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenLibrary}
          title="Sổ tay cục bộ"
          className="hidden md:flex h-8 px-2 rounded-lg items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Sổ tay</span>
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
          <span className="hidden lg:inline font-mono-tabular max-w-[96px] truncate">
            {activeSlug ? `#${activeSlug}` : 'Link Web'}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenSaveAs}
          title="Lưu thành / Xuất PDF, PNG, SVG"
          className="hidden md:flex h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Xuất</span>
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

        {/* Mobile/Tablet Overflow Menu (< md) */}
        <div className="relative md:hidden shrink-0" ref={moreMenuRef}>
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
                className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
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
                  setMoreMenuOpen(false);
                  setStylusMenuOpen(true);
                }}
                className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-amber-600" />
                  Bảng vẽ & Bút (Gaomon / Chỉ bút)
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    stylusSettings.stylusOnly || stylusSettings.activationThreshold > 0
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                      : 'text-slate-400'
                  }`}
                >
                  {stylusSettings.activationThreshold > 0
                    ? `${Math.round(stylusSettings.activationThreshold * 100)}%`
                    : stylusSettings.stylusOnly
                      ? 'BẬT'
                      : 'Cài đặt'}
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
          className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          title={darkMode ? 'Giao diện sáng' : 'Giao diện tối'}
          className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình / Trình chiếu'}
          className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </div>
      </div>

      {/* Row 2 (Expandable / Collapsible): Concise Pen Slots, Stroke Style, Palette, Board Switcher, Auto-Shape & Ruler */}
      {toolsExpanded && (
        <div
          ref={slotEditorRef}
          className="flex items-center justify-start md:justify-center gap-1.5 h-10 -mx-2 lg:-mx-3 px-2 lg:px-3 border-t border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-900/40 overflow-x-auto no-scrollbar"
        >
          <div className="flex items-center gap-1 shrink-0">
            {renderPenControls(false)}
          </div>
          <button
            type="button"
            onClick={toggleToolsExpanded}
            title="Thu gọn dòng công cụ"
            className="hidden md:flex w-7 h-7 rounded-lg items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer ml-1"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Viewport-Safe Floating Popovers (never clipped by overflow-x-auto or narrow screens) */}
      {(quickColorOpen || editingSlot) && (
        <div
          ref={slotPopoverRef}
          className="fixed inset-x-3 top-[90px] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-80 max-h-[calc(100dvh-104px)] overflow-y-auto rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-2xl p-3.5 z-50"
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
                        opacity: t.id === 'highlighter' ? 0.45 : t.id === 'pencil' ? 0.94 : 1,
                        highlightMode:
                          t.id === 'highlighter' ? editingSlot.highlightMode || 'pdf' : undefined,
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

              {/* Highlighter Mode Options (PDF Highlight vs Color Marker vs Block Box) */}
              {editingSlot.tool === 'highlighter' && (
                <div className="mb-3 space-y-2 p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/50">
                  <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                    Chế độ Bút dạ quang
                  </div>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-white/80 dark:bg-slate-900/70">
                    {(
                      [
                        { id: 'pdf', label: 'Tô sáng PDF' },
                        { id: 'marker', label: 'Bôi màu' },
                        { id: 'block', label: 'Tô khung' },
                      ] as const
                    ).map((hm) => {
                      const active = (editingSlot.highlightMode || 'pdf') === hm.id;
                      return (
                        <button
                          key={hm.id}
                          type="button"
                          onClick={() =>
                            onUpdatePenSlot({
                              ...editingSlot,
                              highlightMode: hm.id,
                              opacity:
                                hm.id === 'marker'
                                  ? Math.max(0.55, editingSlot.opacity)
                                  : Math.min(0.6, editingSlot.opacity),
                            })
                          }
                          className={`py-1.5 px-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                            active
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {hm.label}
                        </button>
                      );
                    })}
                  </div>
                  {(editingSlot.highlightMode || 'pdf') !== 'block' && (
                    <label className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-200 cursor-pointer pt-0.5">
                      <span>Tô thẳng hàng (như tô dòng PDF)</span>
                      <input
                        type="checkbox"
                        checked={Boolean(editingSlot.highlightStraight)}
                        onChange={(e) =>
                          onUpdatePenSlot({
                            ...editingSlot,
                            highlightStraight: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                    </label>
                  )}
                </div>
              )}

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

      {/* Gaomon / Stylus Calibration & Palm Rejection Popover */}
      {stylusMenuOpen && (
        <div
          ref={stylusPopoverRef}
          className="fixed inset-x-3 top-12 sm:inset-x-auto sm:right-4 lg:top-14 sm:w-88 max-h-[calc(100dvh-76px)] overflow-y-auto rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-2xl p-4 z-50 space-y-3.5"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Bảng vẽ & Bút cảm ứng (Gaomon, Wacom...)
              </div>
              <div className="text-[11px] text-slate-500">
                Chống nhận nét khi bút chưa chạm bảng & chống tì tay
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStylusMenuOpen(false)}
              className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer px-1.5 py-0.5"
            >
              Đóng
            </button>
          </div>

          <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 cursor-pointer">
            <div>
              <div className="text-xs font-medium text-slate-800 dark:text-slate-100">
                Chế độ Chỉ Bút (Chống tì tay)
              </div>
              <div className="text-[10px] text-slate-500">
                Ngón tay dùng để kéo bảng, chỉ đầu bút mới viết được
              </div>
            </div>
            <input
              type="checkbox"
              checked={stylusSettings.stylusOnly}
              onChange={(e) =>
                onUpdateStylusSettings({
                  ...stylusSettings,
                  stylusOnly: e.target.checked,
                })
              }
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </label>

          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                Ngưỡng lực chạm (Chống bút quá nhạy)
              </span>
              <span className="text-xs font-mono-tabular font-semibold text-amber-600 dark:text-amber-400">
                {Math.round(stylusSettings.activationThreshold * 100)}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Nếu bút Gaomon chưa chạm mặt bảng đã ra nét, hãy tăng ngưỡng này lên <strong>10%–20%</strong>. Bút chỉ bắt đầu viết khi lực nhấn vượt ngưỡng.
            </p>

            <div className="grid grid-cols-4 gap-1">
              {[
                { label: 'Tắt (0%)', val: 0 },
                { label: 'Nhẹ (8%)', val: 0.08 },
                { label: 'Gaomon (15%)', val: 0.15 },
                { label: 'Mạnh (24%)', val: 0.24 },
              ].map((p) => {
                const active = Math.abs(stylusSettings.activationThreshold - p.val) < 0.015;
                return (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() =>
                      onUpdateStylusSettings({
                        ...stylusSettings,
                        activationThreshold: p.val,
                        minMovePx: p.val > 0 && stylusSettings.minMovePx === 0 ? 1.5 : stylusSettings.minMovePx,
                      })
                    }
                    className={`py-1.5 px-1 rounded-lg border text-[10px] font-medium cursor-pointer transition-colors ${
                      active
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <input
              type="range"
              min={0}
              max={0.35}
              step={0.01}
              value={stylusSettings.activationThreshold}
              onChange={(e) =>
                onUpdateStylusSettings({
                  ...stylusSettings,
                  activationThreshold: parseFloat(e.target.value),
                })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
              <span>Lọc rung chạm nhẹ (di chuyển tối thiểu)</span>
              <span className="font-mono-tabular font-semibold">
                {stylusSettings.minMovePx} px
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={6}
              step={0.5}
              value={stylusSettings.minMovePx}
              onChange={(e) =>
                onUpdateStylusSettings({
                  ...stylusSettings,
                  minMovePx: parseFloat(e.target.value),
                })
              }
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Live Stylus Pressure Monitor */}
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Kiểm tra lực bút trực tiếp
              </span>
              <span className="font-mono-tabular text-slate-500">
                {livePenInfo
                  ? `${livePenInfo.pointerType === 'pen' ? 'Bút' : livePenInfo.pointerType} · ${Math.round(livePenInfo.pressure * 100)}%`
                  : 'Di hoặc chạm bút để đo'}
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  livePenInfo &&
                  (livePenInfo.buttons & 1) !== 0 &&
                  livePenInfo.pressure >= stylusSettings.activationThreshold
                    ? 'bg-emerald-500'
                    : 'bg-amber-400'
                }`}
                style={{
                  width: `${Math.min(100, Math.round((livePenInfo?.pressure || 0) * 100))}%`,
                }}
              />
              {stylusSettings.activationThreshold > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-600 z-10"
                  style={{
                    left: `${Math.min(99, Math.round(stylusSettings.activationThreshold * 100))}%`,
                  }}
                />
              )}
            </div>
            <div className="text-[10px] text-slate-500">
              Vạch đỏ là ngưỡng lọc ({Math.round(stylusSettings.activationThreshold * 100)}%). Nếu lơ lửng bút mà thanh vàng vượt vạch đỏ, hãy kéo ngưỡng cao hơn một chút.
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

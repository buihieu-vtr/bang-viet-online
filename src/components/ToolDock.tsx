import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Axis3D,
  Circle,
  Diamond,
  Eraser,
  Flame,
  Grid3X3,
  Hand,
  Highlighter,
  ImagePlus,
  Lasso,
  Maximize,
  Minus,
  MousePointer2,
  Pen,
  Pencil,
  Plus,
  PlusSquare,
  Shapes,
  Sigma,
  Square,
  Star,
  StickyNote,
  Trash2,
  Triangle,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  EraserMode,
  SelectMode,
  ShapeType,
  STICKY_COLORS,
  StrokeStyle,
  ToolType,
} from '../types/inkboard';
import { ColorPalettePicker } from './ColorPalettePicker';

interface ToolDockProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  selectMode: SelectMode;
  onSelectModeChange: (mode: SelectMode) => void;
  eraserMode: EraserMode;
  onEraserModeChange: (mode: EraserMode) => void;
  eraserSize: number;
  onEraserSizeChange: (size: number) => void;
  onClearPage: () => void;
  activeShape: ShapeType;
  onSelectShape: (shape: ShapeType) => void;
  shapeStrokeColor: string;
  onShapeStrokeColorChange: (c: string) => void;
  shapeFillColor: string;
  onShapeFillColorChange: (c: string) => void;
  shapeLineStyle: StrokeStyle;
  onShapeLineStyleChange: (s: StrokeStyle) => void;
  shapeStrokeWidth: number;
  onShapeStrokeWidthChange: (w: number) => void;
  onTriggerImageUpload: () => void;
  onInsertSticky: (bg: string, text: string) => void;
  onInsertMath: () => void;
  onInsertAxesPreset: () => void;
  onInsertTablePreset: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFitScreen: () => void;
  customColors: string[];
  onAddCustomColor: (hex: string) => void;
  onRemoveCustomColor: (hex: string) => void;
  isCompact?: boolean;
}

const SHAPE_OPTIONS: { id: ShapeType; label: string; icon: React.ReactNode }[] = [
  { id: 'line', label: 'Đoạn thẳng', icon: <Minus className="w-4 h-4 -rotate-45" /> },
  { id: 'arrow', label: 'Mũi tên', icon: <ArrowUpRight className="w-4 h-4" /> },
  { id: 'doubleArrow', label: 'Mũi tên 2 chiều', icon: <ArrowRight className="w-4 h-4" /> },
  { id: 'rect', label: 'Hình chữ nhật', icon: <Square className="w-4 h-4" /> },
  { id: 'roundedRect', label: 'Bo góc', icon: <Square className="w-4 h-4 rounded-sm" /> },
  { id: 'ellipse', label: 'Hình tròn / Elip', icon: <Circle className="w-4 h-4" /> },
  { id: 'triangle', label: 'Tam giác cân', icon: <Triangle className="w-4 h-4" /> },
  { id: 'rightTriangle', label: 'Tam giác vuông', icon: <Triangle className="w-4 h-4" /> },
  { id: 'diamond', label: 'Hình thoi', icon: <Diamond className="w-4 h-4" /> },
  { id: 'star', label: 'Ngôi sao', icon: <Star className="w-4 h-4" /> },
  { id: 'axes', label: 'Hệ trục Oxy', icon: <Axis3D className="w-4 h-4" /> },
  { id: 'table', label: 'Bảng 3×3', icon: <Grid3X3 className="w-4 h-4" /> },
];

export const ToolDock: React.FC<ToolDockProps> = ({
  activeTool,
  onSelectTool,
  selectMode,
  onSelectModeChange,
  eraserMode,
  onEraserModeChange,
  eraserSize,
  onEraserSizeChange,
  onClearPage,
  activeShape,
  onSelectShape,
  shapeStrokeColor,
  onShapeStrokeColorChange,
  shapeFillColor,
  onShapeFillColorChange,
  shapeLineStyle,
  onShapeLineStyleChange,
  shapeStrokeWidth,
  onShapeStrokeWidthChange,
  onTriggerImageUpload,
  onInsertSticky,
  onInsertMath,
  onInsertAxesPreset,
  onInsertTablePreset,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitScreen,
  customColors,
  onAddCustomColor,
  onRemoveCustomColor,
  isCompact: isCompactProp,
}) => {
  const [openMenu, setOpenMenu] = useState<'select' | 'eraser' | 'shape' | 'insert' | null>(null);
  const [shapeColorTab, setShapeColorTab] = useState<'stroke' | 'fill'>('stroke');
  const [localCompact, setLocalCompact] = useState(() =>
    typeof window !== 'undefined'
      ? window.innerWidth < 768 || window.innerHeight <= 540
      : false
  );
  const dockRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCompactProp !== undefined) return;
    const onResize = () => {
      setLocalCompact(window.innerWidth < 768 || window.innerHeight <= 540);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isCompactProp]);

  const isCompact = isCompactProp ?? localCompact;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dockRef.current &&
        !dockRef.current.contains(target) &&
        (!popoverRef.current || !popoverRef.current.contains(target))
      ) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, []);

  const toolBtn = (
    id: ToolType,
    label: string,
    icon: React.ReactNode,
    menuKey?: 'select' | 'eraser' | 'shape'
  ) => {
    const isActive = activeTool === id;
    return (
      <button
        type="button"
        onClick={() => {
          if (menuKey) {
            if (isActive) {
              setOpenMenu((prev) => (prev === menuKey ? null : menuKey));
            } else {
              onSelectTool(id);
              setOpenMenu(menuKey);
            }
          } else {
            onSelectTool(id);
            setOpenMenu(null);
          }
        }}
        title={label}
        className={`relative shrink-0 ${isCompact ? 'w-9 h-9' : 'w-10 h-10'} rounded-xl flex items-center justify-center transition-all cursor-pointer ${
          isActive
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        {icon}
        {menuKey && (
          <span
            className={`absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full ${
              isActive ? 'bg-white/80' : 'bg-slate-400'
            }`}
          />
        )}
      </button>
    );
  };

  return (
    <>
      {/* Adaptive Floating Tool Dock: Bottom Horizontal on Compact/Mobile, Left Vertical on Tablet/Desktop */}
      <div
        ref={dockRef}
        className={
          isCompact
            ? 'absolute bottom-2 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100%-16px)] flex flex-row items-center gap-0.5 p-1 rounded-2xl bg-white/95 dark:bg-[#161920]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-lg select-none overflow-x-auto no-scrollbar'
            : 'absolute left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1 p-1.5 rounded-2xl bg-white/95 dark:bg-[#161920]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-lg select-none'
        }
      >
        {toolBtn(
          'select',
          'Chọn đối tượng (Lasso / Hộp)',
          selectMode === 'lasso' ? (
            <Lasso className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />
          ) : (
            <MousePointer2 className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />
          ),
          'select'
        )}

        {toolBtn('pen', 'Bút mực mượt (Phím P)', <Pen className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />)}
        {toolBtn('pencil', 'Bút chì phác thảo', <Pencil className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />)}
        {toolBtn('highlighter', 'Bút dạ quang', <Highlighter className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />)}
        {toolBtn('eraser', 'Tẩy nét / Tẩy vùng (Phím E)', <Eraser className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />, 'eraser')}

        <div
          className={
            isCompact
              ? 'w-px h-5 bg-slate-200 dark:bg-slate-800 mx-0.5 shrink-0'
              : 'h-px bg-slate-200 dark:bg-slate-800 my-0.5 mx-1.5'
          }
        />

        {toolBtn('shape', 'Vẽ hình học & Biểu đồ', <Shapes className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />, 'shape')}
        {toolBtn('text', 'Chèn khung văn bản (Phím T)', <Type className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />)}

        {/* Insert Popover Trigger */}
        <button
          type="button"
          onClick={() => setOpenMenu((prev) => (prev === 'insert' ? null : 'insert'))}
          title="Chèn Ảnh, Ghi chú dán, Toán học, Bảng..."
          className={`shrink-0 ${isCompact ? 'w-9 h-9' : 'w-10 h-10'} rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            openMenu === 'insert' || activeTool === 'sticky'
              ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <PlusSquare className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />
        </button>

        <div
          className={
            isCompact
              ? 'w-px h-5 bg-slate-200 dark:bg-slate-800 mx-0.5 shrink-0'
              : 'h-px bg-slate-200 dark:bg-slate-800 my-0.5 mx-1.5'
          }
        />

        {toolBtn('laser', 'Bút Laser trình chiếu', <Flame className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />)}
        {toolBtn('pan', 'Di chuyển bảng (Phím Space + Kéo)', <Hand className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />)}
      </div>

      {/* Popovers (kept outside dockRef so overflow-x-auto on compact mode never clips them) */}
      {openMenu && (
        <div
          ref={popoverRef}
          className={
            isCompact
              ? 'fixed inset-x-3 bottom-14 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-80 max-h-[60dvh] overflow-y-auto z-50'
              : 'absolute left-16 top-1/2 -translate-y-1/2 z-40'
          }
        >
        {/* Popover: Select Mode */}
        {openMenu === 'select' && (
          <div className={`${isCompact ? 'w-full' : 'w-52'} rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-xl p-2.5`}>
            <div className="text-[11px] font-semibold text-slate-400 px-1 mb-1.5">
              Kiểu vùng chọn
            </div>
            <button
              type="button"
              onClick={() => {
                onSelectModeChange('lasso');
                setOpenMenu(null);
              }}
              className={`w-full px-2.5 py-2 rounded-lg flex items-center gap-2.5 text-xs font-medium cursor-pointer ${
                selectMode === 'lasso'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Lasso className="w-4 h-4" />
              Khoanh vùng tự do (Lasso)
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectModeChange('box');
                setOpenMenu(null);
              }}
              className={`w-full px-2.5 py-2 rounded-lg flex items-center gap-2.5 text-xs font-medium cursor-pointer ${
                selectMode === 'box'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <MousePointer2 className="w-4 h-4" />
              Quét khung chữ nhật
            </button>
          </div>
        )}

        {/* Popover: Eraser Mode */}
        {openMenu === 'eraser' && (
          <div className={`${isCompact ? 'w-full' : 'w-60'} rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-xl p-3 space-y-3`}>
            <div className="text-[11px] font-semibold text-slate-400">Chế độ tẩy</div>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => onEraserModeChange('stroke')}
                className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  eraserMode === 'stroke'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Tẩy cả nét
              </button>
              <button
                type="button"
                onClick={() => onEraserModeChange('partial')}
                className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  eraserMode === 'partial'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Tẩy từng đoạn
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Kích thước đầu tẩy</span>
                <span className="font-mono-tabular">{eraserSize} px</span>
              </div>
              <input
                type="range"
                min={8}
                max={64}
                value={eraserSize}
                onChange={(e) => onEraserSizeChange(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                onClearPage();
                setOpenMenu(null);
              }}
              className="w-full py-2 px-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa sạch trang hiện tại
            </button>
          </div>
        )}

        {/* Popover: Shapes Palette */}
        {openMenu === 'shape' && (
          <div className={`${isCompact ? 'w-full' : 'w-76 max-h-[75dvh] overflow-y-auto'} rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-xl p-3 space-y-3`}>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Chọn hình học
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {SHAPE_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  title={s.label}
                  onClick={() => {
                    onSelectShape(s.id);
                    onSelectTool('shape');
                  }}
                  className={`h-10 rounded-lg flex flex-col items-center justify-center border transition-colors cursor-pointer ${
                    activeShape === s.id
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {s.icon}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setShapeColorTab('stroke')}
                  className={`py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1.5 cursor-pointer ${
                    shapeColorTab === 'stroke'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-black/15"
                    style={{ backgroundColor: shapeStrokeColor }}
                  />
                  Màu viền
                </button>
                <button
                  type="button"
                  onClick={() => setShapeColorTab('fill')}
                  className={`py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1.5 cursor-pointer ${
                    shapeColorTab === 'fill'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-black/15"
                    style={{
                      backgroundColor:
                        shapeFillColor === 'transparent' ? '#ffffff' : shapeFillColor,
                    }}
                  />
                  Màu tô nền
                </button>
              </div>

              {shapeColorTab === 'stroke' ? (
                <ColorPalettePicker
                  color={shapeStrokeColor}
                  onChange={onShapeStrokeColorChange}
                  customColors={customColors}
                  onAddCustomColor={onAddCustomColor}
                  onRemoveCustomColor={onRemoveCustomColor}
                />
              ) : (
                <ColorPalettePicker
                  color={shapeFillColor}
                  onChange={onShapeFillColorChange}
                  customColors={customColors}
                  onAddCustomColor={onAddCustomColor}
                  onRemoveCustomColor={onRemoveCustomColor}
                  allowTransparent
                />
              )}
            </div>

            {/* Shape Line Style & Border Thickness */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-slate-500">
                  Kiểu nét viền
                </div>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {(
                    [
                      { id: 'solid', label: 'Nét liền', dash: undefined },
                      { id: 'dashed', label: 'Nét đứt', dash: '5 3.5' },
                      { id: 'dotted', label: 'Nét chấm', dash: '0.1 4.5' },
                    ] as const
                  ).map((st) => {
                    const active = shapeLineStyle === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => onShapeLineStyleChange(st.id)}
                        className={`py-1.5 px-1 rounded-md flex flex-col items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <svg viewBox="0 0 26 10" className="w-7 h-2.5" aria-hidden="true">
                          <line
                            x1="2"
                            y1="5"
                            x2="24"
                            y2="5"
                            stroke={active ? '#2563EB' : 'currentColor'}
                            strokeWidth={2.4}
                            strokeLinecap="round"
                            strokeDasharray={st.dash}
                          />
                        </svg>
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Độ dày viền</span>
                  <span className="font-mono-tabular font-semibold text-slate-800 dark:text-slate-100">
                    {shapeStrokeWidth} px
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[1.5, 3, 5, 8, 12].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onShapeStrokeWidthChange(preset)}
                      className={`h-7 rounded-md border text-[10px] font-mono-tabular font-medium cursor-pointer transition-colors ${
                        Math.abs(shapeStrokeWidth - preset) < 0.25
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={0.5}
                  value={shapeStrokeWidth}
                  onChange={(e) => onShapeStrokeWidthChange(parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Popover: Insert Menu */}
        {openMenu === 'insert' && (
          <div className={`${isCompact ? 'w-full' : 'w-64 max-h-[75dvh] overflow-y-auto'} rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-xl p-2.5 space-y-1.5`}>
            <div className="text-[11px] font-semibold text-slate-400 px-1.5">
              Chèn vào bảng viết
            </div>

            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                onTriggerImageUpload();
              }}
              className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
            >
              <ImagePlus className="w-4 h-4 text-blue-600" />
              Chèn hình ảnh (PNG/JPG/SVG)
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                onSelectTool('text');
              }}
              className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
            >
              <Type className="w-4 h-4 text-slate-500" />
              Khung văn bản (Text Box)
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                onInsertMath();
              }}
              className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
            >
              <Sigma className="w-4 h-4 text-indigo-600" />
              Ký hiệu & Công thức Toán
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                onInsertAxesPreset();
              }}
              className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
            >
              <Axis3D className="w-4 h-4 text-emerald-600" />
              Hệ trục tọa độ Oxy
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                onInsertTablePreset();
              }}
              className="w-full px-2.5 py-2 rounded-lg text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
            >
              <Grid3X3 className="w-4 h-4 text-amber-600" />
              Bảng dữ liệu 3×3
            </button>

            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 px-1.5">
              <div className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5" />
                Ghi chú dán nhanh (Sticky Note)
              </div>
              <div className="flex items-center gap-1.5">
                {STICKY_COLORS.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    title={s.name}
                    onClick={() => {
                      setOpenMenu(null);
                      onInsertSticky(s.bg, s.text);
                    }}
                    className="w-8 h-8 rounded-lg border border-black/10 hover:scale-105 transition-transform cursor-pointer shadow-xs"
                    style={{ backgroundColor: s.bg }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {/* Compact Zoom Bar: Top-Right on Compact/Mobile, Bottom-Left on Tablet/Desktop */}
      <div
        className={`absolute z-30 flex items-center gap-0.5 rounded-xl bg-white/95 dark:bg-[#161920]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-md select-none ${
          isCompact ? 'top-2 right-2 p-0.5' : 'left-3 bottom-3 p-1'
        }`}
      >
        <button
          type="button"
          onClick={onZoomOut}
          title="Thu nhỏ"
          className={`${isCompact ? 'w-7 h-7' : 'w-8 h-8'} rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer`}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onZoomReset}
          title="Đặt lại tỷ lệ 100%"
          className={`${isCompact ? 'px-1.5 h-7 text-[11px] min-w-[42px]' : 'px-2 h-8 text-xs min-w-[52px]'} rounded-lg font-mono-tabular font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer`}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          title="Phóng to"
          className={`${isCompact ? 'w-7 h-7' : 'w-8 h-8'} rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer`}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
        <button
          type="button"
          onClick={onFitScreen}
          title="Vừa màn hình / Về tâm bảng"
          className={`${isCompact ? 'w-7 h-7' : 'w-8 h-8'} rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer`}
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
};

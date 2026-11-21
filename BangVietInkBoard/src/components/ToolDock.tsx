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
  ToolType,
} from '../types/inkboard';

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
  shapeDashed: boolean;
  onShapeDashedChange: (d: boolean) => void;
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

const SHAPE_COLORS = [
  '#0F172A',
  '#2563EB',
  '#DC2626',
  '#16A34A',
  '#D97706',
  '#9333EA',
  '#FFFFFF',
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
  shapeDashed,
  onShapeDashedChange,
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
}) => {
  const [openMenu, setOpenMenu] = useState<'select' | 'eraser' | 'shape' | 'insert' | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
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
        className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
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
      {/* Left Floating Vertical Tool Dock */}
      <div
        ref={dockRef}
        className="fixed left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1 p-1.5 rounded-2xl bg-white/95 dark:bg-[#161920]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-lg select-none"
      >
        {toolBtn(
          'select',
          'Chọn đối tượng (Lasso / Hộp)',
          selectMode === 'lasso' ? (
            <Lasso className="w-5 h-5" />
          ) : (
            <MousePointer2 className="w-5 h-5" />
          ),
          'select'
        )}

        {toolBtn('pen', 'Bút mực mượt (Phím P)', <Pen className="w-5 h-5" />)}
        {toolBtn('pencil', 'Bút chì phác thảo', <Pencil className="w-5 h-5" />)}
        {toolBtn('highlighter', 'Bút dạ quang', <Highlighter className="w-5 h-5" />)}
        {toolBtn('eraser', 'Tẩy nét / Tẩy vùng (Phím E)', <Eraser className="w-5 h-5" />, 'eraser')}

        <div className="h-px bg-slate-200 dark:bg-slate-800 my-0.5 mx-1.5" />

        {toolBtn('shape', 'Vẽ hình học & Biểu đồ', <Shapes className="w-5 h-5" />, 'shape')}
        {toolBtn('text', 'Chèn khung văn bản (Phím T)', <Type className="w-5 h-5" />)}

        {/* Insert Popover Trigger */}
        <button
          type="button"
          onClick={() => setOpenMenu((prev) => (prev === 'insert' ? null : 'insert'))}
          title="Chèn Ảnh, Ghi chú dán, Toán học, Bảng..."
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            openMenu === 'insert' || activeTool === 'sticky'
              ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <PlusSquare className="w-5 h-5" />
        </button>

        <div className="h-px bg-slate-200 dark:bg-slate-800 my-0.5 mx-1.5" />

        {toolBtn('laser', 'Bút Laser trình chiếu', <Flame className="w-5 h-5" />)}
        {toolBtn('pan', 'Di chuyển bảng (Phím Space + Kéo)', <Hand className="w-5 h-5" />)}

        {/* Popover: Select Mode */}
        {openMenu === 'select' && (
          <div className="absolute left-14 top-0 w-52 rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-xl p-2.5">
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
          <div className="absolute left-14 top-28 w-60 rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-xl p-3 space-y-3">
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
          <div className="absolute left-14 top-20 w-72 rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-xl p-3 space-y-3">
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

            <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">Màu viền</div>
              <div className="flex items-center gap-1.5">
                {SHAPE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onShapeStrokeColorChange(c)}
                    className={`w-6 h-6 rounded-full border cursor-pointer ${
                      shapeStrokeColor === c
                        ? 'ring-2 ring-blue-600 ring-offset-1 dark:ring-offset-slate-900'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-500">Màu tô nền</div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onShapeFillColorChange('transparent')}
                  title="Không tô nền"
                  className={`w-6 h-6 rounded-full border text-[10px] font-bold flex items-center justify-center cursor-pointer ${
                    shapeFillColor === 'transparent'
                      ? 'ring-2 ring-blue-600 border-blue-600 text-blue-600'
                      : 'border-slate-300 text-slate-400'
                  }`}
                >
                  ∅
                </button>
                {['#DBEAFE', '#FEE2E2', '#DCFCE7', '#FEF3C7', '#F3E8FF'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onShapeFillColorChange(c)}
                    className={`w-6 h-6 rounded-full border cursor-pointer ${
                      shapeFillColor === c
                        ? 'ring-2 ring-blue-600 ring-offset-1 dark:ring-offset-slate-900'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200 cursor-pointer pt-1">
              <span>Nét đứt (Dashed)</span>
              <input
                type="checkbox"
                checked={shapeDashed}
                onChange={(e) => onShapeDashedChange(e.target.checked)}
                className="accent-blue-600 w-4 h-4 cursor-pointer"
              />
            </label>
          </div>
        )}

        {/* Popover: Insert Menu */}
        {openMenu === 'insert' && (
          <div className="absolute left-14 bottom-6 w-64 rounded-xl bg-white dark:bg-[#1B1F27] border border-slate-200 dark:border-slate-700 shadow-xl p-2.5 space-y-1.5">
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

      {/* Bottom-left Compact Zoom Bar */}
      <div className="fixed left-3 bottom-3 z-30 flex items-center gap-0.5 p-1 rounded-xl bg-white/95 dark:bg-[#161920]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-md select-none">
        <button
          type="button"
          onClick={onZoomOut}
          title="Thu nhỏ"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onZoomReset}
          title="Đặt lại tỷ lệ 100%"
          className="px-2 h-8 rounded-lg text-xs font-mono-tabular font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer min-w-[52px]"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          title="Phóng to"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
        <button
          type="button"
          onClick={onFitScreen}
          title="Vừa màn hình / Về tâm bảng"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
};

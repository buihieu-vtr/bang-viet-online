import React, { useEffect, useState } from 'react';
import { Check, Pipette, Plus, X } from 'lucide-react';

interface ColorPalettePickerProps {
  color: string;
  onChange: (hex: string) => void;
  customColors: string[];
  onAddCustomColor: (hex: string) => void;
  onRemoveCustomColor?: (hex: string) => void;
  allowTransparent?: boolean;
  label?: string;
}

const PRESET_STRIP = [
  '#0F172A',
  '#334155',
  '#FFFFFF',
  '#FDE047',
  '#FACC15',
  '#FB923C',
  '#EF4444',
  '#EC4899',
  '#9333EA',
  '#2563EB',
  '#06B6D4',
  '#10B981',
  '#274C43',
];

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return { h: 215, s: 80, l: 50 };
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export const ColorPalettePicker: React.FC<ColorPalettePickerProps> = ({
  color,
  onChange,
  customColors,
  onAddCustomColor,
  onRemoveCustomColor,
  allowTransparent = false,
  label,
}) => {
  const initialHsl = color !== 'transparent' ? hexToHsl(color) : { h: 210, s: 85, l: 52 };
  const [hue, setHue] = useState(initialHsl.h);
  const [sat, setSat] = useState(initialHsl.s || 85);
  const [light, setLight] = useState(initialHsl.l || 50);
  const [hexDraft, setHexDraft] = useState(color === 'transparent' ? '#2563EB' : color);

  useEffect(() => {
    if (color && color !== 'transparent' && /^#[0-9a-f]{6}$/i.test(color)) {
      setHexDraft(color.toUpperCase());
      const parsed = hexToHsl(color);
      setHue(parsed.h);
      setSat(parsed.s);
      setLight(parsed.l);
    }
  }, [color]);

  const applyHsl = (nextH: number, nextS: number, nextL: number) => {
    setHue(nextH);
    setSat(nextS);
    setLight(nextL);
    const hex = hslToHex(nextH, nextS, nextL);
    setHexDraft(hex);
    onChange(hex);
  };

  const commitHexInput = (val: string) => {
    setHexDraft(val);
    const normalized = val.startsWith('#') ? val : `#${val}`;
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      onChange(normalized.toUpperCase());
    }
  };

  return (
    <div className="space-y-2.5">
      {label && (
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <span>{label}</span>
          <span className="font-mono-tabular uppercase">
            {color === 'transparent' ? 'Không nền' : color}
          </span>
        </div>
      )}

      {/* Preset Swatch Strip */}
      <div className="flex flex-wrap items-center gap-1.5">
        {allowTransparent && (
          <button
            type="button"
            onClick={() => onChange('transparent')}
            title="Không tô nền"
            className={`w-6 h-6 rounded-full border text-[10px] font-bold flex items-center justify-center cursor-pointer ${
              color === 'transparent'
                ? 'ring-2 ring-blue-600 border-blue-600 text-blue-600'
                : 'border-slate-300 text-slate-400'
            }`}
          >
            ∅
          </button>
        )}
        {PRESET_STRIP.map((c) => {
          const isSelected = color.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={`w-5.5 h-5.5 rounded-full border flex items-center justify-center cursor-pointer transition-transform hover:scale-110 ${
                isSelected
                  ? 'ring-2 ring-blue-600 ring-offset-1 dark:ring-offset-slate-900'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
              style={{ backgroundColor: c }}
            >
              {isSelected && (
                <Check
                  className={`w-3 h-3 ${
                    c === '#FFFFFF' || c === '#FACC15' || c === '#FDE047'
                      ? 'text-slate-900'
                      : 'text-white'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Continuous Rainbow Hue & Lightness Spectrum Bars */}
      <div className="space-y-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
        <div className="text-[10px] font-semibold text-slate-500 flex items-center justify-between">
          <span>Dải màu tự chọn</span>
          <button
            type="button"
            onClick={() => {
              if (color !== 'transparent') onAddCustomColor(color.toUpperCase());
            }}
            className="text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Lưu màu
          </button>
        </div>

        {/* Rainbow Hue Strip */}
        <input
          type="range"
          min={0}
          max={360}
          value={hue}
          onChange={(e) => applyHsl(Number(e.target.value), sat || 85, light === 0 || light === 100 ? 50 : light)}
          title="Kéo để chọn tông màu"
          style={{
            background:
              'linear-gradient(to right, #ef4444 0%, #eab308 17%, #22c55e 33%, #06b6d4 50%, #3b82f6 67%, #a855f7 83%, #ef4444 100%)',
          }}
          className="w-full h-3 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-900 [&::-webkit-slider-thumb]:shadow"
        />

        {/* Lightness Strip */}
        <input
          type="range"
          min={10}
          max={95}
          value={light}
          onChange={(e) => applyHsl(hue, sat || 85, Number(e.target.value))}
          title="Chỉnh độ sáng / tối"
          style={{
            background: `linear-gradient(to right, #000000, ${hslToHex(hue, sat || 85, 50)}, #ffffff)`,
          }}
          className="w-full h-2.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-900 [&::-webkit-slider-thumb]:shadow"
        />

        {/* Saturation Strip */}
        <input
          type="range"
          min={0}
          max={100}
          value={sat}
          onChange={(e) => applyHsl(hue, Number(e.target.value), light)}
          title="Chỉnh độ rực màu"
          style={{
            background: `linear-gradient(to right, ${hslToHex(hue, 0, light)}, ${hslToHex(hue, 100, light)})`,
          }}
          className="w-full h-2 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-900 [&::-webkit-slider-thumb]:shadow"
        />

        {/* HEX + Native Eyedropper */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <label
            title="Bảng chọn màu hệ thống"
            className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700 relative overflow-hidden cursor-pointer shrink-0 flex items-center justify-center shadow-xs"
            style={{ backgroundColor: color === 'transparent' ? '#FFFFFF' : color }}
          >
            <Pipette className="w-3.5 h-3.5 text-white drop-shadow" />
            <input
              type="color"
              value={color === 'transparent' ? '#2563EB' : color}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              className="opacity-0 absolute inset-0 cursor-pointer"
            />
          </label>
          <input
            type="text"
            value={hexDraft}
            onChange={(e) => commitHexInput(e.target.value)}
            maxLength={7}
            placeholder="#274C43"
            className="flex-1 h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-[11px] font-mono-tabular uppercase text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Saved User Custom Colors */}
      {customColors.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-slate-400">
            Màu của bạn ({customColors.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {customColors.map((c) => {
              const isSelected = color.toLowerCase() === c.toLowerCase();
              return (
                <div key={c} className="relative group">
                  <button
                    type="button"
                    onClick={() => onChange(c)}
                    title={c}
                    className={`w-5.5 h-5.5 rounded-full border cursor-pointer transition-transform hover:scale-110 ${
                      isSelected
                        ? 'ring-2 ring-blue-600 ring-offset-1 dark:ring-offset-slate-900'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                  {onRemoveCustomColor && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveCustomColor(c);
                      }}
                      title="Xóa màu này"
                      className="hidden group-hover:flex absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-800 text-white items-center justify-center cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

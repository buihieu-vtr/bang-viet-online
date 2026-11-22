import React, { useState } from 'react';
import { Sigma, X } from 'lucide-react';

interface InsertMathModalProps {
  open: boolean;
  onClose: () => void;
  onInsertText: (text: string) => void;
}

const MATH_SYMBOLS = [
  '∑', '∏', '∫', '∬', '∮', '√', '∛', '∞',
  'π', 'θ', 'α', 'β', 'γ', 'Δ', 'λ', 'μ',
  'σ', 'Ω', '±', '×', '÷', '≠', '≈', '≡',
  '≤', '≥', '∈', '∉', '⊂', '⊆', '∪', '∩',
  '∀', '∃', '⇒', '⇔', '→', '∠', '⊥', '∥',
  '°', '′', '″', 'ℝ', 'ℤ', 'ℕ', 'ℚ', 'ℂ',
];

const QUICK_TEMPLATES = [
  { label: 'Nghiệm bậc 2', value: 'x = (-b ± √(b² - 4ac)) / 2a' },
  { label: 'Định lý Pytago', value: 'a² + b² = c²' },
  { label: 'Tích phân xác định', value: '∫[a→b] f(x) dx = F(b) - F(a)' },
  { label: 'Giới hạn cơ bản', value: 'lim(x→0) (sin x / x) = 1' },
  { label: 'Định luật Newton II', value: 'F⃗ = m · a⃗' },
  { label: 'Năng lượng tương đối', value: 'E = mc²' },
];

export const InsertMathModal: React.FC<InsertMathModalProps> = ({
  open,
  onClose,
  onInsertText,
}) => {
  const [expr, setExpr] = useState('');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#161920] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Sigma className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
              Chèn Công thức & Ký hiệu Toán học
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Biểu thức sẽ chèn lên bảng
            </label>
            <textarea
              rows={2}
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder="Nhấn các ký hiệu bên dưới hoặc gõ biểu thức..."
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base font-mono-tabular text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">
              Bảng ký hiệu Toán & Khoa học
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
              {MATH_SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setExpr((prev) => prev + sym)}
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:border-blue-400 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">
              Mẫu công thức nhanh
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {QUICK_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => setExpr(tpl.value)}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                >
                  <div className="text-[11px] text-slate-500">{tpl.label}</div>
                  <div className="text-xs font-mono-tabular font-medium text-slate-800 dark:text-slate-200 truncate">
                    {tpl.value}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={!expr.trim()}
              onClick={() => {
                onInsertText(expr.trim());
                setExpr('');
                onClose();
              }}
              className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium cursor-pointer"
            >
              Chèn lên bảng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

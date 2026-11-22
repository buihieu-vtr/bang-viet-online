import React from 'react';
import {
  Cloud,
  Globe,
  HelpCircle,
  Save,
  Terminal,
  X,
} from 'lucide-react';

interface HelpGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#161920] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <HelpCircle className="w-5 h-5 text-blue-600 shrink-0" />
            <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
              Hướng dẫn dùng Web miễn phí (Không cần Server)
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

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {/* 1. Chia sẻ miễn phí không cần Server */}
          <section className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 space-y-2">
            <div className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              1. Chia sẻ bảng viết bằng Link (Không cần Server)
            </div>
            <ol className="list-decimal pl-4 space-y-1.5">
              <li>
                Chọn <strong>Bảng xanh</strong> (màu chuẩn RAL 180 30 15 <code className="font-mono-tabular">#274C43</code> có lưới trắng nhạt mỏng) hoặc <strong>Trắng</strong> ngay trên thanh công cụ.
              </li>
              <li>
                Nhấn nút <strong>Link Web</strong> trên thanh trên → đặt tên định danh (và tên miền riêng nếu có) → bấm <strong>Chép Link</strong>.
              </li>
              <li>
                Toàn bộ nét viết, hình học được nén thẳng vào đường link <code className="font-mono-tabular">#ten=...&board=...</code>. Gửi link cho học sinh hoặc đồng nghiệp bấm vào là mở ngay để xem và viết tiếp.
              </li>
            </ol>
          </section>

          {/* 2. Lưu tệp dự án */}
          <section className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Save className="w-4 h-4 text-emerald-600" />
              2. Lưu tệp đuôi riêng (.scrbleweb) & Xuất PDF / PNG
            </div>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>
                Bấm <strong>Xuất</strong> (hoặc <strong>Tệp → Lưu thành...</strong>) để tải tệp đuôi <code className="font-mono-tabular">.scrbleweb</code> / <code className="font-mono-tabular">.inkboard</code> về máy. Sau này chỉ cần kéo-thả tệp đó vào trang web là mở lại chỉnh sửa tiếp.
              </li>
              <li>
                Hỗ trợ xuất trực tiếp ra <strong>Ảnh PNG 2x</strong>, <strong>Vector SVG</strong>, và <strong>PDF nhiều trang</strong>.
              </li>
            </ul>
          </section>

          {/* 3. Đưa web lên mạng miễn phí vĩnh viễn */}
          <section className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Cloud className="w-4 h-4 text-indigo-600" />
              3. Đưa Web lên Host Tĩnh Miễn Phí (Gắn tên miền riêng tùy thích)
            </div>
            <p>
              Ứng dụng là <strong>100% Static Web (HTML + JS + CSS)</strong> — hoàn toàn <strong>không cần thuê VPS hay chạy server</strong>:
            </p>
            <div className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono-tabular text-[11px] space-y-1 overflow-x-auto">
              <div><Terminal className="w-3.5 h-3.5 inline mr-1.5 text-emerald-400" /># Tải code về máy và build ra thư mục dist/ tĩnh:</div>
              <div>npm install</div>
              <div>npm run build</div>
            </div>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                Kéo-thả thư mục <strong><code className="font-mono-tabular">dist/</code></strong> vừa build lên <strong>Cloudflare Pages</strong>, <strong>Netlify Drop</strong>, <strong>Vercel</strong> hoặc <strong>GitHub Pages</strong> (tất cả đều miễn phí vĩnh viễn).
              </li>
              <li>
                Trong phần Custom Domain của các dịch vụ đó, nhập tên miền riêng của bạn (ví dụ <code className="font-mono-tabular">bangviet.tenmiencuaban.vn</code>) là dùng công khai miễn phí không giới hạn.
              </li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
};

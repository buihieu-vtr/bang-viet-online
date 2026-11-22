import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Globe,
  HardDriveDownload,
  Link2,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { NotebookDocument } from '../types/inkboard';
import { encodeBoardToHash, slugifyVietnamese } from '../utils/storage';

interface WebLinkModalProps {
  open: boolean;
  onClose: () => void;
  currentDoc: NotebookDocument;
  onUpdateUrlHash: (hash: string, slugLabel: string) => void;
  onDownloadProjectFile: () => void;
}

const CUSTOM_DOMAIN_KEY = 'inkboard_custom_domain';

export const WebLinkModal: React.FC<WebLinkModalProps> = ({
  open,
  onClose,
  currentDoc,
  onUpdateUrlHash,
  onDownloadProjectFile,
}) => {
  const [slug, setSlug] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [tooLarge, setTooLarge] = useState(false);

  useEffect(() => {
    if (!open) return;
    const savedDomain = localStorage.getItem(CUSTOM_DOMAIN_KEY) || '';
    setCustomDomain(savedDomain);
    setSlug(currentDoc.slug || slugifyVietnamese(currentDoc.title));
    setCopied(false);
    setTooLarge(false);
  }, [open, currentDoc.slug, currentDoc.title]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      const payload = await encodeBoardToHash({
        ...currentDoc,
        slug: slug.trim() || slugifyVietnamese(currentDoc.title),
      });
      if (!active) return;
      const baseOrigin =
        customDomain.trim().replace(/\/+$/, '') ||
        `${window.location.origin}${window.location.pathname}`;
      const cleanLabel = slug.trim() || slugifyVietnamese(currentDoc.title);
      const hashStr = `#ten=${encodeURIComponent(cleanLabel)}&board=${payload}`;
      const url = `${baseOrigin}${hashStr}`;
      setGeneratedUrl(url);
      setTooLarge(url.length > 32000);
    })();
    return () => {
      active = false;
    };
  }, [open, currentDoc, slug, customDomain]);

  if (!open) return null;

  const handleCopy = async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleApplyToAddressBar = async () => {
    const cleanLabel = slug.trim() || slugifyVietnamese(currentDoc.title);
    const payload = await encodeBoardToHash({ ...currentDoc, slug: cleanLabel });
    const hashStr = `#ten=${encodeURIComponent(cleanLabel)}&board=${payload}`;
    onUpdateUrlHash(hashStr, cleanLabel);
  };

  const handleDomainChange = (val: string) => {
    setCustomDomain(val);
    localStorage.setItem(CUSTOM_DOMAIN_KEY, val);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#161920] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Globe className="w-5 h-5 text-blue-600 shrink-0" />
            <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
              Chia sẻ Link Web (100% Không cần Server)
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

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Custom Name / Slug Label */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                1. Tên định danh bảng viết trên đường dẫn
              </label>
              <button
                type="button"
                onClick={() => setSlug(slugifyVietnamese(currentDoc.title))}
                className="text-[11px] font-medium text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                Lấy từ tiêu đề
              </button>
            </div>
            <input
              type="text"
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
              }
              placeholder="bai-giang-toan-12"
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono-tabular text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Custom Domain Optional Prefix */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">
              2. Tên miền tùy đặt của bạn (tùy chọn)
            </label>
            <input
              type="url"
              value={customDomain}
              onChange={(e) => handleDomainChange(e.target.value)}
              placeholder={`Mặc định: ${window.location.origin}${window.location.pathname}`}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono-tabular text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Shareable Link Result */}
          <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 space-y-3">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-blue-600" />
              Đường link mở lại bảng viết để làm tiếp
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono-tabular text-slate-800 dark:text-slate-200 truncate">
                {generatedUrl || 'Đang nén dữ liệu bảng...'}
              </div>
              <button
                type="button"
                disabled={!generatedUrl || tooLarge}
                onClick={handleCopy}
                className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Đã chép' : 'Chép Link'}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={tooLarge}
                onClick={handleApplyToAddressBar}
                className="h-8 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Link2 className="w-3.5 h-3.5 text-blue-600" />
                Gắn link này vào thanh địa chỉ trình duyệt
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDownloadProjectFile();
                }}
                className="h-8 px-3 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
              >
                <HardDriveDownload className="w-3.5 h-3.5" />
                Hoặc tải file .scrbleweb
              </button>
            </div>

            {tooLarge && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                Bảng hiện tại có ảnh dung lượng lớn nên link URL sẽ quá dài. Hãy dùng nút &quot;Hoặc tải file .scrbleweb&quot; để lưu và gửi file cho người khác mở lại.
              </p>
            )}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Dữ liệu bảng được nén trực tiếp vào chính đường link (`#board=...`) và lưu tự động trong trình duyệt (IndexedDB). Không cần chạy server, không cần tài khoản — chạy hoàn toàn miễn phí trên GitHub Pages, Cloudflare Pages, Netlify hoặc Vercel.
          </p>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  CheckCircle2,
  Cloud,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { auth, googleProvider } from '../firebase';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onAuthToast: (msg: string) => void;
  onRefreshUser: () => Promise<void>;
}

function mapFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/popup-closed-by-user') {
    return 'Bạn đã đóng cửa sổ đăng nhập Google.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Trình duyệt đang chặn cửa sổ bật lên. Hãy cho phép Pop-up rồi thử lại.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Chức năng đăng nhập Email/Mật khẩu chưa được bật trên Firebase Console (Authentication → Sign-in method). Bạn có thể dùng "Đăng nhập nhanh với Google" ở trên ngay lập tức.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email hoặc mật khẩu không đúng.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Email này đã được đăng ký. Hãy chuyển sang thẻ Đăng nhập.';
  }
  if (code === 'auth/weak-password') {
    return 'Mật khẩu cần tối thiểu 6 ký tự.';
  }
  if (code === 'auth/invalid-email') {
    return 'Địa chỉ email không hợp lệ.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.';
  }
  return err instanceof Error ? err.message : 'Không thể xác thực tài khoản.';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  user,
  onAuthToast,
  onRefreshUser,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      onAuthToast(`Xin chào ${cred.user.displayName || cred.user.email}! Dữ liệu đã được tách biệt theo tài khoản.`);
      onClose();
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 80) });
        }
        try {
          await sendEmailVerification(cred.user);
          onAuthToast('Đăng ký thành công! Vui lòng kiểm tra hộp thư để xác minh email trước khi đồng bộ đám mây.');
        } catch {
          onAuthToast('Đăng ký tài khoản thành công!');
        }
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        onAuthToast(`Đã đăng nhập: ${cred.user.displayName || cred.user.email}`);
        if (cred.user.emailVerified) {
          onClose();
        }
      }
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await sendEmailVerification(user);
      onAuthToast('Đã gửi lại email xác minh. Hãy kiểm tra hộp thư hoặc thư mục Spam.');
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut(auth);
      onAuthToast('Đã đăng xuất. Đang quay lại không gian khách cục bộ.');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#161920] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
            <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
              Tài khoản & Tách biệt dữ liệu
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
          {user ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar'}
                    className="w-11 h-11 rounded-full object-cover border border-slate-300 dark:border-slate-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-base shrink-0">
                    {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {user.displayName || 'Thành viên InkBoard'}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{user.email}</div>
                </div>
              </div>

              {user.emailVerified ? (
                <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                  <Cloud className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold flex items-center gap-1.5">
                      Đã kích hoạt đồng bộ & tách biệt dữ liệu
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <p className="mt-0.5 opacity-90">
                      Toàn bộ sổ tay, trang A4 và dải màu tự chọn của bạn được lưu riêng biệt theo tài khoản này.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-amber-600" />
                    Email chưa được xác minh
                  </div>
                  <p className="opacity-90 leading-relaxed">
                    Để bảo vệ dữ liệu riêng tư, vui lòng bấm vào liên kết trong email xác minh đã gửi tới <strong>{user.email}</strong> rồi nhấn Làm mới.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleResendVerification}
                      className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium cursor-pointer disabled:opacity-50"
                    >
                      Gửi lại email
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        await onRefreshUser();
                        setBusy(false);
                      }}
                      className="h-8 px-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Đã xác minh
                    </button>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={handleSignOut}
                className="w-full h-10 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Đăng xuất tài khoản
              </button>
            </div>
          ) : (
            <>
              {/* Instant Google Sign-In */}
              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleSignIn}
                className="w-full h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center justify-center gap-2.5 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.31 0 3.25 2.69 1.27 6.6l3.66 2.84C5.79 6.86 8.64 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-1.99 3.72-4.93 3.72-8.69z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M4.93 14.56c-.22-.66-.35-1.36-.35-2.06s.13-1.4.35-2.06L1.27 7.6C.46 9.23 0 11.06 0 12.5s.46 3.27 1.27 4.9l3.66-2.84z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.08.72-2.45 1.16-4.23 1.16-3.36 0-6.21-1.86-7.07-4.44l-3.66 2.84C3.25 21.31 7.31 24 12 24z"
                  />
                </svg>
                Đăng nhập / Đăng ký nhanh với Google
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
                <span className="px-3 text-[11px] text-slate-400">hoặc dùng Email</span>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
              </div>

              {/* Login / Register Switch */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    mode === 'login'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg(null);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    mode === 'register'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Đăng ký mới
                </button>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {mode === 'register' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      Tên hiển thị
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Ví dụ: Thầy Minh / Cô Lan"
                        maxLength={80}
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@cuaban.com"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    Mật khẩu
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {busy
                    ? 'Đang xử lý...'
                    : mode === 'register'
                      ? 'Đăng ký tài khoản riêng'
                      : 'Đăng nhập'}
                </button>
              </form>

              <p className="text-[11px] text-slate-500 leading-relaxed text-center">
                Mỗi tài khoản có thư viện sổ tay, bảng viết và dải màu tách biệt hoàn toàn với người khác.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

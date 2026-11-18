import React, { useState } from 'react';
import { 
  X, 
  User, 
  Lock, 
  Church, 
  Phone, 
  ShieldCheck, 
  LogIn, 
  UserPlus, 
  KeyRound,
  AlertCircle
} from 'lucide-react';
import { apiRequest, setToken, setSavedUser } from '../api';

export default function AuthModal({ 
  isOpen, 
  onClose, 
  onLoginSuccess 
}) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regChurch, setRegChurch] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await apiRequest('/auth/login', 'POST', {
        username: loginUsername.trim(),
        password: loginPassword
      });

      setToken(res.token);
      setSavedUser(res.user);
      onLoginSuccess(res.user);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await apiRequest('/auth/register', 'POST', {
        username: regUsername,
        full_name: regFullName,
        church: regChurch,
        phone: regPhone,
        password: regPassword
      });

      setToken(res.token);
      setSavedUser(res.user);
      onLoginSuccess(res.user);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'فشل تسجيل الحساب الجديد');
    } finally {
      setLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setActiveTab('login');
    setLoginUsername('admin');
    setLoginPassword('admin123');
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div 
        className="w-full max-w-md bg-[#fffefc] rounded-3xl shadow-2xl border border-amber-900/20 overflow-hidden flex flex-col text-stone-900 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-amber-50 border-b border-amber-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl text-amber-400">✝</span>
            <div>
              <h2 id="auth-modal-title" className="text-base sm:text-lg font-bold text-amber-200">
                تسجيل المتسابقين والدخول
              </h2>
              <p className="text-xs text-amber-400/80">لحفظ درجاتك، أوقاتك، والدخول للوحة الأدمن</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition"
            aria-label="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs switcher */}
        <div className="flex border-b border-stone-200 bg-stone-100/60 p-1">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'login'
                ? 'bg-white text-amber-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>تسجيل الدخول</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('register'); setErrorMsg(''); }}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'register'
                ? 'bg-white text-amber-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>متسابق جديد</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  اسم المستخدم أو البريد
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="مثال: admin أو اسمك"
                    className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'جاري التحقق...' : 'دخول'}</span>
              </button>

              {/* Quick Admin Test Hint */}
              <div className="pt-3 border-t border-stone-200 text-center">
                <button
                  type="button"
                  onClick={fillAdminCredentials}
                  className="text-xs text-amber-700 hover:text-amber-900 font-semibold flex items-center justify-center gap-1 mx-auto hover:underline"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>دخول تجريبي بحساب مسؤول المسابقة (الأدمن)</span>
                </button>
              </div>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  الاسم بالكامل (سيظهر في لوحة الشرف) *
                </label>
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="مثال: يوسف حنا ناصف"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  اسم المستخدم (لتسجيل الدخول) *
                </label>
                <input
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="مثال: youssef_hanna"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  الكنيسة / الخدمة (اختياري)
                </label>
                <input
                  type="text"
                  value={regChurch}
                  onChange={(e) => setRegChurch(e.target.value)}
                  placeholder="مثال: كنيسة السيدة العذراء"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  رقم الهاتف (للتواصل في الجوائز)
                </label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  كلمة المرور *
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'جاري التسجيل...' : 'تسجيل والبدء في المسابقة'}</span>
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}

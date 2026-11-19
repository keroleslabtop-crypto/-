import React, { useState } from 'react';
import { 
  Menu, 
  Trophy, 
  Bookmark, 
  User, 
  LogOut, 
  Shield, 
  Sparkles, 
  Award,
  ChevronDown,
  BookOpen
} from 'lucide-react';

export default function Navbar({ 
  onToggleSidebar, 
  onOpenLeaderboard, 
  onJumpToCurrentChapter, 
  currentUser, 
  onOpenAuth, 
  onLogout,
  onOpenAdmin,
  activeChapterId
}) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const lastChapter = currentUser?.progress?.last_chapter_id || activeChapterId || 1;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md text-amber-50 border-b border-amber-900/40 shadow-lg">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 min-h-16 py-2 sm:py-0 sm:h-16 flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-2 gap-y-2">
        
        {/* Left: Hamburger menu toggle for 21 chapters sidebar (#1 in sketch) */}
        <div className="order-1 flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            id="chapter-menu-btn"
            onClick={onToggleSidebar}
            aria-haspopup="dialog"
            aria-controls="chapter-drawer"
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-amber-900/50 text-amber-300 border border-amber-700/40 flex items-center gap-2 transition-all active:scale-95 shadow-sm hover:shadow"
            title="قائمة الأصحاحات الـ 21"
            aria-label="قائمة الأصحاحات الـ 21"
          >
            <Menu className="w-5 h-5" />
            <span className="hidden sm:inline font-bold text-xs sm:text-sm">الأصحاحات (٢١)</span>
          </button>

          {/* Site Title & Spiritual Icon */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-inner font-bold text-lg select-none">
              ✝
            </div>
            <div className="hidden md:block">
              <h1 className="text-sm font-extrabold text-amber-200 tracking-wide leading-tight">
                دراسة في سفر القضاة
              </h1>
              <p className="text-[11px] text-amber-400/80">دراسة وتأمل واختبارات الأصحاحات</p>
            </div>
          </div>
        </div>

        {/* Center: #6 Leaderboard & #5 Current Chapter button */}
        <div className="order-3 w-full sm:order-none sm:w-auto flex items-center justify-between sm:justify-center gap-2 sm:gap-3">
          {/* #6 Leaderboard Button (ترتيب المتصدرين بالدرجات ثم السرعة) */}
          <button
            onClick={onOpenLeaderboard}
            className="flex-1 sm:flex-none justify-center min-w-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl bg-gradient-to-r from-amber-600/30 to-amber-500/20 hover:from-amber-600/50 hover:to-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold text-xs sm:text-sm transition-all sm:hover:scale-105 shadow-sm active:scale-95"
            title="لوحة الشرف وترتيب المتصدرين"
          >
            <Trophy className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="inline">المتصدرون</span>
          </button>

          {/* #5 Resume / Current Chapter Button (زر الأصحاح المتوقف عنده) */}
          <button
            onClick={() => onJumpToCurrentChapter(lastChapter)}
            className="flex-1 sm:flex-none justify-center min-w-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-bold text-xs sm:text-sm transition-all active:scale-95 hover:shadow-md"
            title={`الانتقال إلى الأصحاح الذي توقفت عنده (أصحاح ${lastChapter})`}
          >
            <Bookmark className="w-4 h-4 text-amber-400 fill-amber-400/30" />
            <span className="hidden sm:inline text-amber-200/90 font-normal text-xs">أين توقفت:</span>
            <span className="text-amber-300 font-bold">أصحاح {lastChapter}</span>
          </button>
        </div>

        {/* Right: #7 Login / User Profile & Admin menu (قائمة تسجيل الدخول) */}
        <div className="order-2 ml-auto sm:order-none relative shrink-0">
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 border border-amber-600/30 text-amber-100 text-xs sm:text-sm font-medium transition-all"
                aria-expanded={profileDropdownOpen}
              >
                <div className="w-7 h-7 rounded-full bg-amber-600/40 border border-amber-500/50 flex items-center justify-center text-amber-300 font-bold text-xs">
                  {currentUser.role === 'admin' ? <Shield className="w-4 h-4 text-amber-400" /> : <User className="w-4 h-4" />}
                </div>
                <div className="text-right hidden sm:block">
                  <div className="font-bold text-amber-200 leading-tight truncate max-w-[120px]">
                    {currentUser.full_name || currentUser.username}
                  </div>
                  {currentUser.role === 'admin' ? (
                    <span className="text-[10px] text-amber-400 font-semibold bg-amber-950/60 px-1 rounded">مسؤول المسابقة</span>
                  ) : (
                    <span className="text-[10px] text-amber-300/80 font-normal">
                      {currentUser.progress?.total_score || 0} نقطة
                    </span>
                  )}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400/70" />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setProfileDropdownOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-amber-700/40 shadow-2xl py-2 z-40 text-stone-200 divide-y divide-slate-800 animate-in fade-in slide-in-from-top-2 duration-150 profile-dropdown-enter">
                    <div className="px-4 py-2 text-right">
                      <p className="text-xs text-amber-400/80">مرحباً بك،</p>
                      <p className="font-bold text-sm text-amber-200 truncate">{currentUser.full_name}</p>
                      {currentUser.church && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{currentUser.church}</p>
                      )}
                      {currentUser.role !== 'admin' && (
                        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-amber-300">
                          <span>إجمالي النقاط:</span>
                          <span className="font-bold text-amber-400">{currentUser.progress?.total_score || 0}</span>
                        </div>
                      )}
                    </div>

                    <div className="py-1">
                      {currentUser.role === 'admin' && (
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            onOpenAdmin();
                          }}
                          className="w-full text-right px-4 py-2 text-xs sm:text-sm text-amber-300 hover:bg-slate-800 flex items-center gap-2 transition"
                        >
                          <Shield className="w-4 h-4 text-amber-400" />
                          <span>لوحة إدارة المسابقة (الأدمن)</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onOpenLeaderboard();
                        }}
                        className="w-full text-right px-4 py-2 text-xs sm:text-sm hover:bg-slate-800 flex items-center gap-2 transition"
                      >
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span>ترتيب المتسابقين</span>
                      </button>

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onJumpToCurrentChapter(lastChapter);
                        }}
                        className="w-full text-right px-4 py-2 text-xs sm:text-sm hover:bg-slate-800 flex items-center gap-2 transition"
                      >
                        <BookOpen className="w-4 h-4 text-amber-400" />
                        <span>الأصحاح المتوقف عنده ({lastChapter})</span>
                      </button>
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full text-right px-4 py-2 text-xs sm:text-sm text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 transition"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>تسجيل الخروج</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95"
            >
              <User className="w-4 h-4" />
              <span>دخول / تسجيل</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}

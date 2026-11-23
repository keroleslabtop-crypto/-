import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trophy, 
  Clock, 
  Award, 
  Search, 
  Medal, 
  CheckCircle, 
  User, 
  Sparkles,
  Church
} from 'lucide-react';
import { apiRequest } from '../api';

export default function LeaderboardModal({ 
  isOpen, 
  onClose, 
  currentUserId 
}) {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setErrorMsg('');
      apiRequest('/leaderboard')
        .then(data => {
          setLeaderboard(data);
          setLoading(false);
        })
        .catch(err => {
          setErrorMsg(err.message || 'تعذر تحميل لوحة المتصدرين');
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = leaderboard.filter(item => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (item.full_name && item.full_name.toLowerCase().includes(q)) ||
      (item.church && item.church.toLowerCase().includes(q))
    );
  });

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '0 ث';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s} ثانية`;
    return `${m} د و ${s} ث`;
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-modal-title"
    >
      <div 
        className="w-full max-w-3xl bg-[#fffefc] rounded-3xl shadow-2xl border border-amber-900/20 overflow-hidden flex flex-col text-stone-900 max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-amber-50 border-b border-amber-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shadow-inner">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 id="leaderboard-modal-title" className="text-base sm:text-xl font-black text-amber-200 leading-tight">
                لوحة الشرف وترتيب المتصدرين
              </h2>
              <p className="text-xs text-amber-400/80 mt-0.5">
                الترتيب محسوب أولاً بأعلى الدرجات، وعند التساوي بالأسرع في زمن الإجابة ⚡
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition"
            aria-label="إغلاق لوحة المتصدرين"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-3 sm:p-4 bg-amber-50/60 border-b border-amber-900/10 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الكنيسة..."
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
          <span className="text-xs text-stone-500 font-bold shrink-0">
            {filtered.length} متسابق
          </span>
        </div>

        {/* Leaderboard Table / List */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          {loading ? (
            <div className="py-16 text-center text-stone-500 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold">جاري حساب درجات وسرعات المتسابقين...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm text-center">
              {errorMsg}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-stone-500">
              <Trophy className="w-12 h-12 text-stone-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-stone-700">لا توجد نتائج مطابقة لبحثك</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((item) => {
                const isCurrentUser = currentUserId && item.user_id === currentUserId;
                const isTop1 = item.rank === 1;
                const isTop2 = item.rank === 2;
                const isTop3 = item.rank === 3;

                return (
                  <div
                    key={item.user_id}
                    className={`p-3 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 ${
                      isCurrentUser
                        ? 'bg-amber-100/90 border-amber-500 ring-2 ring-amber-400 shadow-md'
                        : isTop1
                        ? 'bg-gradient-to-r from-amber-500/15 via-amber-100/60 to-white border-amber-400/80 shadow-sm'
                        : isTop2
                        ? 'bg-gradient-to-r from-slate-200/50 to-white border-slate-300'
                        : isTop3
                        ? 'bg-gradient-to-r from-amber-900/10 to-white border-amber-800/30'
                        : 'bg-[#faf8f5] hover:bg-white border-stone-200/80'
                    }`}
                  >
                    {/* Rank & User Info */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 w-full sm:w-auto">
                      {/* Rank Icon / Badge */}
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                        {isTop1 ? (
                          <span className="text-2xl drop-shadow select-none">🥇</span>
                        ) : isTop2 ? (
                          <span className="text-2xl drop-shadow select-none">🥈</span>
                        ) : isTop3 ? (
                          <span className="text-2xl drop-shadow select-none">🥉</span>
                        ) : (
                          <span className="w-8 h-8 rounded-lg bg-stone-200/80 text-stone-700 flex items-center justify-center font-bold text-xs">
                            {item.rank}
                          </span>
                        )}
                      </div>

                      {/* Contestant details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm sm:text-sm font-bold text-stone-900 whitespace-normal break-words leading-snug">
                            {item.full_name}
                          </h4>
                          {isCurrentUser && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white shrink-0">
                              أنت 👤
                            </span>
                          )}
                        </div>

                        {item.church && (
                          <p className="text-[11px] text-stone-500 flex items-center gap-1 truncate mt-0.5">
                            <Church className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>{item.church}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Score, Time & Completed Chapters */}
                    <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-4 w-full sm:w-auto shrink-0 text-left">
                      {/* Completed Chapters */}
                      <div className="text-center hidden sm:block">
                        <span className="text-[10px] text-stone-400 block">الأصحاحات</span>
                        <span className="text-xs font-bold text-stone-700">
                          {item.completed_chapters_count || 0} / 21
                        </span>
                      </div>

                      {/* Speed / Total Time */}
                      <div className="text-center bg-white/70 px-1.5 sm:px-2.5 py-1 rounded-xl border border-stone-200">
                        <span className="text-[9px] sm:text-[10px] text-stone-400 block flex items-center justify-center gap-0.5">
                          <Clock className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-sky-600" />
                          السرعة
                        </span>
                        <span className="text-xs font-mono font-bold text-sky-800">
                          {formatTime(item.total_time_seconds)}
                        </span>
                      </div>

                      {/* Total Score */}
                      <div className="text-center bg-amber-500/15 px-2 sm:px-3 py-1 rounded-xl border border-amber-400/40 min-w-[62px] sm:min-w-[70px]">
                        <span className="text-[9px] sm:text-[10px] text-amber-900/80 block font-semibold">المجموع</span>
                        <span className="text-sm sm:text-base font-black text-amber-800 whitespace-nowrap">
                          {item.total_score} <span className="text-[10px] font-normal">نقطة</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-amber-50/70 border-t border-amber-900/10 text-center text-xs text-amber-900/80">
          «جَاهَدْتُ الْجِهَادَ الْحَسَنَ، أَكْمَلْتُ السَّعْيَ، حَفِظْتُ الإِيمَانَ، وَأَخِيرًا قَدْ وُضِعَ لِي إِكْلِيلُ الْبِرِّ»
        </div>

      </div>
    </div>
  );
}

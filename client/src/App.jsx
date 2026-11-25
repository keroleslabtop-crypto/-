import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ChapterDrawer from './components/ChapterDrawer';
import ChapterReader from './components/ChapterReader';
import QuizModal from './components/QuizModal';
import LeaderboardModal from './components/LeaderboardModal';
import AuthModal from './components/AuthModal';
import AdminDashboard from './components/AdminDashboard';
import { apiRequest, getToken, setToken, setSavedUser } from './api';
import { 
  Award, 
  CheckCircle2, 
  Clock, 
  HelpCircle, 
  Sparkles, 
  BookOpen, 
  ChevronRight, 
  ChevronLeft,
  Share2,
  Lock
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [activeChapterId, setActiveChapterId] = useState(1);
  const [activeChapter, setActiveChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quizSchedule, setQuizSchedule] = useState({ opens_at: null, closes_at: null, is_open: true });

  // Modals state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  // Load current user session and chapters on startup
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    setLoading(true);

    // 1. Try restoring logged in user
    if (getToken()) {
      try {
        const me = await apiRequest('/auth/me');
        setCurrentUser(me.user);
        if (me.user?.progress?.last_chapter_id) {
          setActiveChapterId(me.user.progress.last_chapter_id);
        }
      } catch (e) {
        console.error('Session expired:', e);
        setToken(null);
        setSavedUser(null);
      }
    }

    // 2. Load 21 chapters list
    try {
      const chs = await apiRequest('/chapters');
      setChapters(chs);
    } catch (e) {
      console.error('Failed to load chapters:', e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch active chapter details whenever activeChapterId changes
  useEffect(() => {
    if (activeChapterId) {
      apiRequest(`/chapters/${activeChapterId}`)
        .then(data => {
          setActiveChapter(data);

          // If logged in, update current chapter on server for #5 tracking
          if (currentUser) {
            apiRequest('/user/current-chapter', 'POST', { chapter_id: activeChapterId })
              .catch(() => {});
          }
        })
        .catch(err => console.error('Failed to load active chapter:', err));
    }
  }, [activeChapterId, currentUser]);

  const handleSelectChapter = (cid) => {
    setActiveChapterId(cid);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    setToken(null);
    setSavedUser(null);
    setCurrentUser(null);
    // Refresh chapters to clear attempt badges
    apiRequest('/chapters').then(chs => setChapters(chs));
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user.progress?.last_chapter_id) {
      setActiveChapterId(user.progress.last_chapter_id);
    }
    // Refresh chapters with user attempts
    apiRequest('/chapters').then(chs => setChapters(chs));
  };

  const handleQuizCompleted = (result) => {
    // Refresh user progress
    apiRequest('/auth/me')
      .then(me => setCurrentUser(me.user))
      .catch(() => {});

    // Refresh chapters list
    apiRequest('/chapters')
      .then(chs => setChapters(chs))
      .catch(() => {});

    // Refresh current chapter details
    apiRequest(`/chapters/${activeChapterId}`)
      .then(data => setActiveChapter(data))
      .catch(() => {});
  };

  const handleChapterUpdated = (updatedChapter) => {
    // 1. Refresh chapters list so sidebar, question count, and badges update immediately
    apiRequest('/chapters').then(chs => setChapters(chs));

    // 2. Refresh active chapter full details directly from database
    if (!updatedChapter || Number(updatedChapter.id) === Number(activeChapterId)) {
      apiRequest(`/chapters/${activeChapterId}`).then(data => setActiveChapter(data));
    }
  };

  const lastChapterId = currentUser?.progress?.last_chapter_id || activeChapterId || 1;
  const isChapterCompleted = activeChapter?.user_attempt && activeChapter.user_attempt.score !== undefined;
  const refreshQuizSchedule = () => apiRequest(`/quiz-schedule?chapter_id=${activeChapterId}`).then(setQuizSchedule).catch(() => {});

  useEffect(() => {
    apiRequest(`/quiz-schedule?chapter_id=${activeChapterId}`).then(setQuizSchedule).catch(() => {});
  }, [activeChapterId]);
  const quizScheduleText = !quizSchedule.is_open
    ? `الامتحان مغلق حاليًا${quizSchedule.opens_at ? ` • موعد الفتح: ${new Date(quizSchedule.opens_at).toLocaleString('ar-EG')}` : ''}`
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#fbf9f5] text-stone-900 selection:bg-amber-200">
      
      {/* 1. Header & Navigation (matches items #1, #6, #5, #7) */}
      <Navbar
        onToggleSidebar={() => setDrawerOpen(true)}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
        onJumpToCurrentChapter={handleSelectChapter}
        currentUser={currentUser}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenAdmin={() => setAdminModalOpen(true)}
        activeChapterId={activeChapterId}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        
        {/* Breadcrumb & Chapter Quick Stepper */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 backdrop-blur-sm p-3 sm:p-4 rounded-2xl border border-amber-900/10 shadow-xs">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-stone-600">
            <button
              onClick={() => setDrawerOpen(true)}
              className="font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1"
            >
              <BookOpen className="w-4 h-4 text-amber-600" />
              <span>فهرس الأصحاحات الـ ٢١</span>
            </button>
            <span className="text-stone-300">/</span>
            <span className="font-extrabold text-stone-900">
              {activeChapter?.title || `الأصحاح ${activeChapterId}`}
            </span>
          </div>

          {/* Previous / Next Chapter Buttons */}
          <div className="flex items-center gap-2">
            <button
              disabled={activeChapterId <= 1}
              onClick={() => handleSelectChapter(activeChapterId - 1)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-bold text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>

            <span className="text-xs font-bold px-2 text-amber-800">
              {activeChapterId} من ٢١
            </span>

            <button
              disabled={activeChapterId >= 21}
              onClick={() => handleSelectChapter(activeChapterId + 1)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-bold text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition"
            >
              <span>التالي</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Chapter Written Text Box (#2 in sketch: الاصحاح مكتوب) */}
        <ChapterReader
          chapter={activeChapter}
          currentUser={currentUser}
          onEditInAdmin={(cid) => {
            setAdminModalOpen(true);
          }}
        />

        {/* 4. Quiz Action Button (#4 in sketch: زرار اختبار علي كل اصحاح) */}
        <section 
          aria-labelledby="quiz-section-action"
          className="bg-gradient-to-br from-amber-900/10 via-[#fffefc] to-amber-600/10 rounded-3xl border-2 border-amber-500/40 p-6 sm:p-8 shadow-xl text-center relative overflow-hidden"
        >
          {/* Spiritual background glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-600/20 rounded-full blur-2xl pointer-events-none" />

          <div className="max-w-xl mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-white flex items-center justify-center mx-auto shadow-lg">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
                اختبار الأصحاح {activeChapterId}
              </span>
              <h3 id="quiz-section-action" className="text-xl sm:text-2xl font-black text-stone-900 mt-2">
                جاهز لاختبار فهمك وسرعتك في {activeChapter?.title}؟
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 mt-1">
                {activeChapter?.question_count 
                  ? `يحتوي الاختبار على ${activeChapter.question_count} أسئلة اختيار من متعدد، مع احتساب وقت الإجابة بالثواني.`
                  : 'أسئلة روحية وتأملية مع احتساب السرعة والدرجات بدقة.'
                }
              </p>
            </div>

            {/* If user already completed this chapter quiz */}
            {isChapterCompleted ? (
              <div className="space-y-3">
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm font-bold text-emerald-950 shadow-xs">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    الدرجة المسجلة: {activeChapter.user_attempt.score} من {activeChapter.user_attempt.max_score}
                  </span>
                  <span className="flex items-center gap-1.5 text-sky-800 font-mono">
                    <Clock className="w-5 h-5 text-sky-600" />
                    السرعة: {activeChapter.user_attempt.time_spent_seconds} ثانية
                  </span>
                </div>

                <div className="p-2.5 bg-amber-50 border border-amber-300/80 rounded-xl text-xs text-amber-900 font-bold flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4 text-amber-700" />
                  <span>تم تسجيل إجاباتك وتُحسب في لوحة المتصدرين</span>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => { refreshQuizSchedule(); setQuizModalOpen(true); }}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-sm shadow-md transition flex items-center justify-center gap-2 mx-auto"
                  >
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    <span>تم تسجيل إجاباتك وتُحسب في لوحة المتصدرين</span>
                  </button>
                </div>
              </div>
            ) : (
              /* The Main Prominent Quiz Button (#4) */
              <div>
                <button
                  type="button"
                  disabled={!quizSchedule.is_open}
                  onClick={() => { refreshQuizSchedule(); setQuizModalOpen(true); }}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-white font-black text-base sm:text-lg shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2.5 mx-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <Sparkles className="w-5 h-5 text-amber-100 animate-spin-slow" />
                    <span>{quizScheduleText || 'ابدأ اختبار الأصحاح الآن'}</span>
                  <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full font-normal">
                    ⚡ السرعة والدرجة (محاولة واحدة فقط)
                  </span>
                </button>
              </div>
            )}

            <p className="text-[11px] text-stone-500">
              * تم تسجيل إجاباتك وتُحسب في لوحة المتصدرين
            </p>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-12 bg-slate-950 text-stone-400 border-t border-amber-900/30 py-8 px-4 text-center text-xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <span className="text-lg">✝</span>
            <span>دراسة في سفر القضاة - ٢١ أصحاح</span>
          </div>

          <div className="text-stone-500 text-[11px]">
            «وَكُلُّ مَا تَفْعَلُونَ فَافْعَلُوا مِنَ الْقَلْبِ، كَمَا لِلرَّبِّ لَيْسَ لِلنَّاسِ» (كو ٣: ٢٣)
          </div>

          <div>
            {currentUser?.role === 'admin' ? (
              <button
                onClick={() => setAdminModalOpen(true)}
                className="text-amber-400 hover:underline font-bold"
              >
                لوحة تحكم الأدمن
              </button>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="text-stone-400 hover:text-amber-300 transition"
              >
                دخول المسؤول (الأدمن)
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* MODALS */}
      
      {/* 1. Sidebar Chapter Drawer (#1 in sketch) */}
      <ChapterDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        chapters={chapters}
        activeChapterId={activeChapterId}
        onSelectChapter={handleSelectChapter}
        lastChapterId={lastChapterId}
      />

      {/* 4. Quiz Modal (#4 in sketch) */}
      <QuizModal
        isOpen={quizModalOpen}
        onClose={() => setQuizModalOpen(false)}
        chapter={activeChapter}
        currentUser={currentUser}
        onQuizCompleted={handleQuizCompleted}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {/* 6. Leaderboard Modal (#6 in sketch) */}
      <LeaderboardModal
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        currentUserId={currentUser?.id}
      />

      {/* 7. Auth Modal (#7 in sketch) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Admin Dashboard Modal */}
      <AdminDashboard
        isOpen={adminModalOpen}
        onClose={() => { setAdminModalOpen(false); refreshQuizSchedule(); }}
        chapters={chapters}
        onChapterUpdated={handleChapterUpdated}
        initialChapterId={activeChapterId}
      />

    </div>
  );
}

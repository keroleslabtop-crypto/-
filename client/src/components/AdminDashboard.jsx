import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Edit3, 
  Plus, 
  Trash2, 
  Video, 
  BookOpen, 
  HelpCircle, 
  Users, 
  BarChart3, 
  RotateCcw,
  Clock,
  Check,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Tv
} from 'lucide-react';
import { apiRequest } from '../api';

export default function AdminDashboard({ 
  isOpen, 
  onClose, 
  chapters, 
  onChapterUpdated,
  initialChapterId = 1
}) {
  const [activeTab, setActiveTab] = useState('chapters'); // 'chapters', 'questions', 'contestants'
  const [selectedChapterId, setSelectedChapterId] = useState(initialChapterId);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  // Chapter editing form
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editText, setEditText] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editVideoTitle, setEditVideoTitle] = useState('');

  // Questions management
  const [chapterQuestions, setChapterQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // New question form state
  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState(['', '', '', '']);
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qExplanation, setQExplanation] = useState('');
  const [qPoints, setQPoints] = useState(10);

  // Stats & contestants list
  const [stats, setStats] = useState(null);
  const [schedule, setSchedule] = useState({ opens_at: '', closes_at: '' });
  const [scheduleChapterId, setScheduleChapterId] = useState(1);

  const toLocalDateTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  // Sync selected chapter data into edit form
  useEffect(() => {
    if (isOpen && selectedChapterId) {
      const ch = chapters.find(c => c.id === Number(selectedChapterId));
      if (ch) {
        // Fetch full chapter from server to get full text
        apiRequest(`/chapters/${selectedChapterId}`)
          .then(fullCh => {
            setEditTitle(fullCh.title || '');
            setEditSubtitle(fullCh.subtitle || '');
            setEditText(fullCh.text_content || '');
            setEditVideoUrl(fullCh.video_url || '');
            setEditVideoTitle(fullCh.video_title || '');
          })
          .catch(err => console.error(err));
      }

      // Fetch questions if on questions tab
      loadQuestions(selectedChapterId);
    }
  }, [isOpen, selectedChapterId, chapters]);

  // Load stats when dashboard opens
  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      apiRequest(`/quiz-schedule?chapter_id=${scheduleChapterId}`)
        .then(data => setSchedule({ opens_at: toLocalDateTime(data.opens_at), closes_at: toLocalDateTime(data.closes_at) }))
        .catch(console.error);
    }
  }, [isOpen, scheduleChapterId]);

  const saveSchedule = async (e) => {
    e.preventDefault();
    try {
      const result = await apiRequest('/admin/quiz-schedule', 'PUT', {
        chapter_id: Number(scheduleChapterId),
        opens_at: schedule.opens_at ? new Date(schedule.opens_at).toISOString() : null,
        closes_at: schedule.closes_at ? new Date(schedule.closes_at).toISOString() : null
      });
      setStatusMsg({ text: result.message, type: 'success' });
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    }
  };

  const loadStats = () => {
    apiRequest('/admin/stats')
      .then(data => setStats(data))
      .catch(err => console.error(err));
  };

  const loadQuestions = (cid) => {
    setLoadingQuestions(true);
    apiRequest(`/admin/chapters/${cid}/questions`)
      .then(qs => {
        setChapterQuestions(qs);
        setLoadingQuestions(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingQuestions(false);
      });
  };

  if (!isOpen) return null;

  // Save chapter changes (text & video)
  const handleSaveChapter = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ text: '', type: '' });

    try {
      const res = await apiRequest(`/admin/chapters/${selectedChapterId}`, 'PUT', {
        title: editTitle,
        subtitle: editSubtitle,
        text_content: editText,
        video_url: editVideoUrl,
        video_title: editVideoTitle
      });

      setStatusMsg({ text: 'تم حفظ تعديلات الأصحاح بنجاح', type: 'success' });
      if (onChapterUpdated) {
        onChapterUpdated(res.chapter);
      }
    } catch (err) {
      setStatusMsg({ text: err.message || 'حدث خطأ أثناء الحفظ', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Add or edit question
  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        question_text: qText,
        options: qOptions,
        correct_index: qCorrectIdx,
        explanation: qExplanation,
        points: qPoints
      };

      if (editingQuestion) {
        await apiRequest(`/admin/questions/${editingQuestion.id}`, 'PUT', payload);
      } else {
        await apiRequest(`/admin/chapters/${selectedChapterId}/questions`, 'POST', payload);
      }

      setShowAddQuestionModal(false);
      setEditingQuestion(null);
      resetQuestionForm();
      loadQuestions(selectedChapterId);
      loadStats();
      if (onChapterUpdated) {
        onChapterUpdated({ id: selectedChapterId });
      }
      setStatusMsg({ text: 'تم حفظ السؤال بنجاح في سوبابيز وتحديث الموقع', type: 'success' });
    } catch (err) {
      alert(err.message || 'فشل حفظ السؤال');
    } finally {
      setLoading(false);
    }
  };

  const resetQuestionForm = () => {
    setQText('');
    setQOptions(['', '', '', '']);
    setQCorrectIdx(0);
    setQExplanation('');
    setQPoints(10);
  };

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السؤال؟')) return;
    try {
      await apiRequest(`/admin/questions/${qId}`, 'DELETE');
      loadQuestions(selectedChapterId);
      loadStats();
      if (onChapterUpdated) {
        onChapterUpdated({ id: selectedChapterId });
      }
    } catch (err) {
      alert(err.message || 'فشل حذف السؤال');
    }
  };

  const handleResetContestant = async (userId, name) => {
    if (!window.confirm(`هل أنت متأكد من إعادة ضبط درجات المتسابق "${name}" وتصفير نتيجته؟`)) return;
    try {
      await apiRequest(`/admin/reset-contestant/${userId}`, 'POST');
      loadStats();
      alert(`تمت إعادة ضبط درجات المتسابق "${name}" بنجاح`);
    } catch (err) {
      alert(err.message || 'تعذر إعادة ضبط المتسابق');
    }
  };

  const handleDeleteContestant = async (userId, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب "${name}" وكل نتائجه؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    try {
      await apiRequest(`/admin/contestants/${userId}`, 'DELETE');
      loadStats();
      setStatusMsg({ text: `تم حذف حساب ${name}`, type: 'success' });
    } catch (err) {
      setStatusMsg({ text: err.message || 'تعذر حذف الحساب', type: 'error' });
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-dashboard-title"
    >
      <div 
        className="w-full max-w-5xl bg-[#fffefc] rounded-3xl shadow-2xl border border-amber-900/30 overflow-hidden flex flex-col text-stone-900 max-h-[95vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Admin Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-950 via-slate-950 to-amber-950 text-amber-50 border-b border-amber-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="admin-dashboard-title" className="text-base sm:text-xl font-black text-amber-200">
                  لوحة تحكم مسؤول المسابقة (Admin)
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-slate-950">
                  إدارة شاملة
                </span>
              </div>
              <p className="text-xs text-amber-400/80">
                تحرير نصوص وفيديوهات الأصحاحات الـ 21، وإدارة الأسئلة، ومتابعة درجات وسرعات المتسابقين
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition"
            aria-label="إغلاق لوحة الأدمن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Stats Bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-amber-50/70 border-b border-amber-900/10 text-center">
            <div className="bg-white p-2 rounded-xl border border-amber-200/80">
              <span className="text-[11px] text-stone-500 block">إجمالي المتسابقين</span>
              <span className="text-base font-black text-amber-800">{stats.contestantsCount}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-amber-200/80">
              <span className="text-[11px] text-stone-500 block">الاختبارات المكتملة</span>
              <span className="text-base font-black text-emerald-800">{stats.attemptsCount}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-amber-200/80">
              <span className="text-[11px] text-stone-500 block">متوسط الدرجات</span>
              <span className="text-base font-black text-sky-800">{stats.avgScore} د</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-amber-200/80">
              <span className="text-[11px] text-stone-500 block">أسئلة بنك الاختبارات</span>
              <span className="text-base font-black text-purple-800">{stats.questionsCount} سؤال</span>
            </div>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap border-b border-stone-200 bg-stone-100/70 px-2 sm:px-4 pt-2 gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveTab('chapters')}
            className={`w-full sm:w-auto min-w-0 justify-center px-2 sm:px-4 py-2 text-[11px] sm:text-sm text-center leading-tight whitespace-normal sm:whitespace-nowrap font-bold rounded-t-xl transition flex items-center gap-1.5 border-t border-x ${
              activeTab === 'chapters'
                ? 'bg-white text-amber-900 border-stone-200 -mb-px'
                : 'bg-transparent text-stone-600 border-transparent hover:text-stone-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-700" />
            <span>نصوص وفيديوهات الـ ٢١ أصحاح</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`w-full sm:w-auto min-w-0 justify-center px-2 sm:px-4 py-2 text-[11px] sm:text-sm text-center leading-tight whitespace-normal sm:whitespace-nowrap font-bold rounded-t-xl transition flex items-center gap-1.5 border-t border-x ${
              activeTab === 'questions'
                ? 'bg-white text-amber-900 border-stone-200 -mb-px'
                : 'bg-transparent text-stone-600 border-transparent hover:text-stone-900'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-amber-700" />
            <span>أسئلة واختبارات الأصحاحات</span>
          </button>

          <button
            onClick={() => setActiveTab('contestants')}
            className={`w-full sm:w-auto min-w-0 justify-center px-2 sm:px-4 py-2 text-[11px] sm:text-sm text-center leading-tight whitespace-normal sm:whitespace-nowrap font-bold rounded-t-xl transition flex items-center gap-1.5 border-t border-x ${
              activeTab === 'contestants'
                ? 'bg-white text-amber-900 border-stone-200 -mb-px'
                : 'bg-transparent text-stone-600 border-transparent hover:text-stone-900'
            }`}
          >
            <Users className="w-4 h-4 text-amber-700" />
            <span>المتسابقون والنتائج ({stats?.contestantsCount || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`w-full sm:w-auto min-w-0 justify-center px-2 sm:px-4 py-2 text-[11px] sm:text-sm text-center leading-tight whitespace-normal sm:whitespace-nowrap font-bold rounded-t-xl transition flex items-center gap-1.5 border-t border-x ${activeTab === 'schedule' ? 'bg-white text-amber-900 border-stone-200 -mb-px' : 'bg-transparent text-stone-600 border-transparent hover:text-stone-900'}`}
          >
            <Clock className="w-4 h-4 text-amber-700" />
            <span>مواعيد الامتحان</span>
          </button>
        </div>

        {/* Main Dashboard Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          
          {statusMsg.text && (
            <div className={`mb-4 p-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
              statusMsg.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {statusMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* TAB 1: Edit Chapter Text & Video */}
          {activeTab === 'chapters' && (
            <div className="space-y-4">
              {/* Chapter selector pill row */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  اختر الأصحاح للتعديل:
                </label>
                <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
                  {chapters.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedChapterId(c.id);
                        setStatusMsg({ text: '', type: '' });
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                        c.id === Number(selectedChapterId)
                          ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                      }`}
                    >
                      أصحاح {c.number}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSaveChapter} className="space-y-4 bg-[#faf8f5] p-4 sm:p-6 rounded-2xl border border-stone-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      عنوان الأصحاح *
                    </label>
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      العنوان الفرعي / الفكرة الرئيسية
                    </label>
                    <input
                      type="text"
                      value={editSubtitle}
                      onChange={(e) => setEditSubtitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Video Settings */}
                <div className="p-4 rounded-xl bg-white border border-stone-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <Tv className="w-4 h-4 text-amber-600" />
                    <span>إعدادات فيديو الأصحاح (المطلوب في النقطة 3)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1">
                        رابط الفيديو (رابط يوتيوب أو فيديو مباشر)
                      </label>
                      <input
                        type="url"
                        value={editVideoUrl}
                        onChange={(e) => setEditVideoUrl(e.target.value)}
                        placeholder="مثال: https://www.youtube.com/watch?v=..."
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1">
                        عنوان الفيديو أو اسم الخادم / التأمل
                      </label>
                      <input
                        type="text"
                        value={editVideoTitle}
                        onChange={(e) => setEditVideoTitle(e.target.value)}
                        placeholder="مثال: تأمل روحي في آيات الأصحاح"
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Chapter Text Area */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-stone-700">
                      النص الكامل المكتوب للأصحاح (المطلوب في النقطة 2) *
                    </label>
                    <span className="text-[11px] text-stone-500">
                      اكتب الآيات والأرقام مع التشكيل أو بدونه
                    </span>
                  </div>
                  <textarea
                    rows={12}
                    required
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full p-4 rounded-2xl border border-stone-300 bg-white font-scripture text-base sm:text-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm shadow-md flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{loading ? 'جاري الحفظ...' : 'حفظ بيانات الأصحاح والفيديو'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: Manage Quiz Questions per Chapter */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50/70 p-3 rounded-2xl border border-amber-200/80">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-700">أصحاح:</span>
                  <select
                    value={selectedChapterId}
                    onChange={(e) => setSelectedChapterId(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm font-bold text-stone-800"
                  >
                    {chapters.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.question_count || 0} أسئلة)
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => {
                    resetQuestionForm();
                    setEditingQuestion(null);
                    setShowAddQuestionModal(true);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة سؤال جديد للأصحاح</span>
                </button>
              </div>

              {/* Questions List */}
              {loadingQuestions ? (
                <div className="py-12 text-center text-stone-500">جاري تحميل الأسئلة...</div>
              ) : chapterQuestions.length === 0 ? (
                <div className="py-12 text-center text-stone-500 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                  <HelpCircle className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-stone-700">لا توجد أسئلة مسجلة لهذا الأصحاح بعد</p>
                  <button
                    onClick={() => {
                      resetQuestionForm();
                      setEditingQuestion(null);
                      setShowAddQuestionModal(true);
                    }}
                    className="mt-3 px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs"
                  >
                    أضف أول سؤال الآن
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {chapterQuestions.map((q, idx) => (
                    <div 
                      key={q.id}
                      className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs flex items-start justify-between gap-3"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <h4 className="text-sm font-bold text-stone-900">{q.question_text}</h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            {q.points || 10} درجات
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-8 text-xs">
                          {q.options?.map((opt, oIdx) => (
                            <div 
                              key={oIdx}
                              className={`p-2 rounded-xl border flex items-center gap-2 ${
                                oIdx === q.correct_index 
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' 
                                  : 'bg-stone-50 border-stone-200 text-stone-700'
                              }`}
                            >
                              <span className="w-4 h-4 rounded-full border text-[10px] flex items-center justify-center">
                                {oIdx === q.correct_index ? '✓' : oIdx + 1}
                              </span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>

                        {q.explanation && (
                          <p className="text-[11px] text-stone-500 pr-8">
                            📖 مرجع / شرح: {q.explanation}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditingQuestion(q);
                            setQText(q.question_text);
                            setQOptions([...q.options]);
                            setQCorrectIdx(q.correct_index);
                            setQExplanation(q.explanation || '');
                            setQPoints(q.points || 10);
                            setShowAddQuestionModal(true);
                          }}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-amber-800 hover:bg-stone-100 transition"
                          title="تعديل السؤال"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                          title="حذف السؤال"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Contestants & Results List */}
          {activeTab === 'contestants' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-800">قائمة المتسابقين المسجلين</h3>
                  <p className="text-xs text-stone-500">مرتبين حسب درجاتهم وأوقاتهم (السرعة)</p>
                </div>
                <button
                  onClick={loadStats}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-100 flex items-center gap-1 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>تحديث</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                <table className="w-full text-right text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">الاسم بالكامل</th>
                      <th className="p-3">الكنيسة / الخدمة</th>
                      <th className="p-3">الهاتف</th>
                      <th className="p-3">الأصحاح المتوقف عنده</th>
                      <th className="p-3">مجموع الدرجات</th>
                      <th className="p-3">السرعة (مجموع الثواني)</th>
                      <th className="p-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-700">
                    {stats?.contestantsList?.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-amber-50/40 transition">
                        <td className="p-3 font-bold">{idx + 1}</td>
                        <td className="p-3 font-bold text-stone-900">{c.full_name}</td>
                        <td className="p-3 text-stone-500">{c.church || '-'}</td>
                        <td className="p-3 font-mono">{c.phone || '-'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold">
                            أصحاح {c.last_chapter_id || 1}
                          </span>
                        </td>
                        <td className="p-3 font-black text-amber-700">{c.total_score || 0} د</td>
                        <td className="p-3 font-mono text-sky-800">{c.total_time_seconds || 0} ثانية</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleResetContestant(c.id, c.full_name)}
                            className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition font-bold"
                            title="إعادة ضبط نتائج المتسابق"
                          >
                            تصفير
                          </button>
                          <button
                            onClick={() => handleDeleteContestant(c.id, c.full_name)}
                            className="mr-1 px-2.5 py-1 rounded-lg text-white bg-rose-600 hover:bg-rose-700 transition font-bold"
                            title="حذف حساب المتسابق"
                          >
                            حذف
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <form onSubmit={saveSchedule} className="max-w-xl mx-auto space-y-5">
              <div>
                <h3 className="text-lg font-black text-stone-900">تحديد موعد كل امتحان</h3>
                <p className="text-sm text-stone-600 mt-1">اختر الامتحان وحدد فترة فتحه وإغلاقه بشكل مستقل. اترك الخانات فارغة لفتحه دون موعد محدد. التوقيت حسب المنطقة الزمنية للجهاز.</p>
              </div>
              <label className="block text-sm font-bold text-stone-700">الامتحان
                <select value={scheduleChapterId} onChange={e => setScheduleChapterId(Number(e.target.value))} className="mt-1 block w-full rounded-xl border border-stone-300 p-3">
                  {chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title || `الامتحان ${chapter.id}`}</option>)}
                </select>
              </label>
              <label className="block text-sm font-bold text-stone-700">يفتح الامتحان في
                <input type="datetime-local" value={schedule.opens_at} onChange={e => setSchedule(s => ({ ...s, opens_at: e.target.value }))} className="mt-1 block w-full rounded-xl border border-stone-300 p-3" />
              </label>
              <label className="block text-sm font-bold text-stone-700">يغلق الامتحان في
                <input type="datetime-local" value={schedule.closes_at} onChange={e => setSchedule(s => ({ ...s, closes_at: e.target.value }))} className="mt-1 block w-full rounded-xl border border-stone-300 p-3" />
              </label>
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-amber-700 text-white font-bold hover:bg-amber-800">حفظ المواعيد</button>
            </form>
          )}

        </div>

        {/* Modal for Adding/Editing Question */}
        {showAddQuestionModal && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <h3 className="font-bold text-base text-stone-900">
                  {editingQuestion ? 'تعديل السؤال' : 'إضافة سؤال جديد للأصحاح'}
                </h3>
                <button 
                  onClick={() => setShowAddQuestionModal(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveQuestion} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    نص السؤال *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    placeholder="مثال: من هو الذي جاء إلى يسوع ليلاً؟"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700">
                    الخيارات الأربعة (حدد الدائرة أمام الإجابة الصحيحة) *
                  </label>
                  {qOptions.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct_option"
                        checked={qCorrectIdx === oIdx}
                        onChange={() => setQCorrectIdx(oIdx)}
                        className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                        title="اختر كإجابة صحيحة"
                      />
                      <input
                        type="text"
                        required
                        value={opt}
                        onChange={(e) => {
                          const updated = [...qOptions];
                          updated[oIdx] = e.target.value;
                          setQOptions(updated);
                        }}
                        placeholder={`خيار ${oIdx + 1}`}
                        className={`flex-1 px-3 py-1.5 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 ${
                          qCorrectIdx === oIdx ? 'border-emerald-500 bg-emerald-50/30' : 'border-stone-300'
                        }`}
                      />
                      {qCorrectIdx === oIdx && (
                        <span className="text-[10px] font-bold text-emerald-700 shrink-0">
                          الصحيحة ✓
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      الدرجة / النقاط
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={qPoints}
                      onChange={(e) => setQPoints(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl border border-stone-300 text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      مرجع الآية أو الشرح الروحي
                    </label>
                    <input
                      type="text"
                      value={qExplanation}
                      onChange={(e) => setQExplanation(e.target.value)}
                      placeholder="مثال: يوحنا ٣: ١"
                      className="w-full px-3 py-1.5 rounded-xl border border-stone-300 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setShowAddQuestionModal(false)}
                    className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-600 hover:bg-stone-100"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow"
                  >
                    حفظ السؤال
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

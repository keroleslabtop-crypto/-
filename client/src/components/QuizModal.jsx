import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Clock, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  Award, 
  ArrowLeft, 
  ArrowRight, 
  Sparkles,
  ChevronLeft,
  Lock,
  ShieldAlert
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest } from '../api';

export default function QuizModal({
  isOpen,
  onClose,
  chapter,
  currentUser,
  onQuizCompleted,
  onOpenAuth
}) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const timerRef = useRef(null);

  const alreadyCompleted = Boolean(chapter?.user_attempt && chapter.user_attempt.score !== undefined);

  // Load questions when modal opens
  useEffect(() => {
    if (isOpen && chapter) {
      setLoading(true);
      setErrorMsg('');
      setSelectedAnswers({});
      setCurrentQIndex(0);
      setTimeSpentSeconds(0);

      // If already completed in Supabase, show their saved score directly
      if (chapter.user_attempt && chapter.user_attempt.score !== undefined) {
        setQuizResult({
          score: chapter.user_attempt.score,
          max_score: chapter.user_attempt.max_score,
          percentage: Math.round((chapter.user_attempt.score / chapter.user_attempt.max_score) * 100),
          time_spent_seconds: chapter.user_attempt.time_spent_seconds,
          is_previous: true
        });
      } else {
        setQuizResult(null);
      }

      apiRequest(`/chapters/${chapter.id}/quiz`)
        .then(data => {
          setQuestions(data.questions || []);
          setLoading(false);
        })
        .catch(err => {
          setErrorMsg(err.message || 'تعذر تحميل أسئلة الاختبار');
          setLoading(false);
        });
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, chapter]);

  // Stopwatch timer during quiz (only if not already completed)
  useEffect(() => {
    if (isOpen && !loading && !quizResult && !alreadyCompleted && questions.length > 0) {
      timerRef.current = setInterval(() => {
        setTimeSpentSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, loading, quizResult, alreadyCompleted, questions]);

  if (!isOpen) return null;

  const handleSelectOption = (qId, optionIdx) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [qId]: optionIdx
    }));
  };

  const handleSubmit = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    // Stop timer
    if (timerRef.current) clearInterval(timerRef.current);

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await apiRequest(`/chapters/${chapter.id}/quiz/submit`, 'POST', {
        answers: selectedAnswers,
        time_spent_seconds: timeSpentSeconds
      });

      setQuizResult(res);

      // Trigger celebratory confetti if score >= 80%
      if (res.percentage >= 70) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

      if (onQuizCompleted) {
        onQuizCompleted(res);
      }
    } catch (err) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تصحيح الاختبار');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const currentQ = questions[currentQIndex];

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-modal-title"
    >
      <div 
        className="w-full max-w-2xl bg-[#fffefc] rounded-3xl shadow-2xl border border-amber-900/20 overflow-hidden flex flex-col text-stone-900 max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-amber-50 border-b border-amber-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
              ✝
            </div>
            <div>
              <h2 id="quiz-modal-title" className="text-base sm:text-lg font-bold text-amber-200 leading-tight">
                اختبار {chapter?.title}
              </h2>
              <p className="text-xs text-amber-400/80">
                {quizResult ? 'نتائج الاختبار والمراجعة الروحية' : 'أجب بالدقة والسرعة لتتصدر لوحة الشرف'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Stopwatch Timer (#6 speed factor) */}
            {!quizResult && !loading && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/90 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs sm:text-sm">
                <Clock className="w-4 h-4 text-amber-400 animate-spin-slow" />
                <span>{formatTimer(timeSpentSeconds)}</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition"
              aria-label="إغلاق الاختبار"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          {loading ? (
            <div className="py-16 text-center text-stone-500 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold">جاري تحضير أسئلة الأصحاح...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm text-center">
              {errorMsg}
            </div>
          ) : questions.length === 0 ? (
            <div className="py-12 text-center text-stone-500">
              <HelpCircle className="w-12 h-12 text-amber-600/40 mx-auto mb-2" />
              <p className="text-sm font-bold text-stone-700">لا توجد أسئلة مسجلة لهذا الأصحاح حالياً</p>
              <p className="text-xs text-stone-500 mt-1">يمكن للأدمن إضافة أسئلة من لوحة التحكم.</p>
            </div>
          ) : quizResult ? (
            /* Results Screen */
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-100/50 to-amber-500/15 border border-amber-300/80 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-white flex items-center justify-center mx-auto shadow-lg mb-3">
                  <Award className="w-9 h-9" />
                </div>
                <h3 className="text-xl font-black text-amber-950">
                  {quizResult.percentage >= 80 ? 'ممتاز جداً! بركة عظيمة' : 'أحسنت! تم تسجيل نتيجتك'}
                </h3>
                <p className="text-xs text-amber-900/80 mt-1 flex items-center justify-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>تم تسجيل إجاباتك وتُحسب في لوحة المتصدرين</span>
                </p>

                {/* Score and Time stats */}
                <div className="grid grid-cols-3 gap-2 mt-4 max-w-md mx-auto">
                  <div className="bg-white/80 p-2.5 rounded-2xl border border-amber-200/80">
                    <span className="text-[11px] text-stone-500 block">الدرجة</span>
                    <span className="text-lg font-black text-amber-700">
                      {quizResult.score} / {quizResult.max_score}
                    </span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-2xl border border-amber-200/80">
                    <span className="text-[11px] text-stone-500 block">النسبة المئوية</span>
                    <span className="text-lg font-black text-emerald-700">
                      %{quizResult.percentage}
                    </span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-2xl border border-amber-200/80">
                    <span className="text-[11px] text-stone-500 block">السرعة / الزمن</span>
                    <span className="text-lg font-black text-sky-700 font-mono">
                      {quizResult.time_spent_seconds} ثانية
                    </span>
                  </div>
                </div>
              </div>

              {/* Review Section */}
              <div>
                <h4 className="text-sm font-extrabold text-stone-800 mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  مراجعة الإجابات والتأمل في الآيات
                </h4>

                <div className="space-y-3">
                  {quizResult.review?.map((rev, idx) => (
                    <div 
                      key={idx}
                      className={`p-4 rounded-2xl border text-right ${
                        rev.is_correct 
                          ? 'bg-emerald-50/50 border-emerald-200' 
                          : 'bg-rose-50/50 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {rev.is_correct ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-bold text-stone-900 leading-snug">
                            {idx + 1}. {rev.question_text}
                          </p>

                          <div className="mt-2 text-xs space-y-1">
                            <p className="text-stone-700">
                              إجابتك: <span className={rev.is_correct ? 'font-bold text-emerald-800' : 'font-bold text-rose-700'}>
                                {rev.chosen_index !== null ? rev.options[rev.chosen_index] : 'لم تجب'}
                              </span>
                            </p>
                            {!rev.is_correct && (
                              <p className="text-stone-700">
                                الإجابة الصحيحة: <span className="font-bold text-emerald-800">
                                  {rev.options[rev.correct_index]}
                                </span>
                              </p>
                            )}
                            {rev.explanation && (
                              <p className="text-[11px] text-stone-500 bg-white/70 p-2 rounded-xl mt-1.5 border border-stone-200">
                                📖 <span className="font-semibold text-stone-700">مرجع وتأمل:</span> {rev.explanation}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Active Quiz Interface */
            <div className="space-y-5">
              {/* Progress Bar & Indicators */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-stone-600 mb-1.5">
                  <span>السؤال {currentQIndex + 1} من {questions.length}</span>
                  <span className="text-amber-700 font-bold">
                    تمت الإجابة على {answeredCount} من {questions.length}
                  </span>
                </div>
                <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-300"
                    style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Current Question Card */}
              {currentQ && (
                <div className="p-5 rounded-2xl bg-[#faf8f5] border border-amber-900/10 shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {currentQIndex + 1}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-stone-900 leading-snug">
                      {currentQ.question_text}
                    </h3>
                  </div>

                  {/* Options List */}
                  <div className="mt-4 space-y-2.5">
                    {currentQ.options?.map((opt, optIdx) => {
                      const isChosen = selectedAnswers[currentQ.id] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(currentQ.id, optIdx)}
                          className={`w-full text-right p-3.5 rounded-xl border text-sm font-semibold transition-all flex items-center justify-between gap-3 ${
                            isChosen
                              ? 'bg-amber-100/80 border-amber-600 text-amber-950 shadow-sm ring-1 ring-amber-500'
                              : 'bg-white hover:bg-amber-50/50 border-stone-200 text-stone-800 hover:border-amber-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                              isChosen 
                                ? 'bg-amber-600 border-amber-600 text-white' 
                                : 'border-stone-300 text-stone-500'
                            }`}>
                              {['أ', 'ب', 'ج', 'د', 'هـ'][optIdx] || optIdx + 1}
                            </span>
                            <span>{opt}</span>
                          </div>

                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isChosen ? 'border-amber-600' : 'border-stone-300'
                          }`}>
                            {isChosen && <div className="w-2 h-2 rounded-full bg-amber-600" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Navigation buttons between questions */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  disabled={currentQIndex === 0}
                  onClick={() => setCurrentQIndex(prev => prev - 1)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-xs sm:text-sm font-bold text-stone-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-100 flex items-center gap-1 transition"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>السؤال السابق</span>
                </button>

                {currentQIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQIndex(prev => prev + 1)}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-bold flex items-center gap-1 shadow transition active:scale-95"
                  >
                    <span>السؤال التالي</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmit}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-50"
                  >
                    {submitting ? (
                      <span>جاري التصحيح...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تسليم وإنهاء الاختبار</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {!currentUser && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 text-center">
                  💡 تنبيه: لتسجيل درجتك في لوحة المتصدرين وتتبع تقدمك، يرجى{' '}
                  <button onClick={onOpenAuth} className="font-bold underline text-amber-800">
                    تسجيل الدخول هنا
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-100/80 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
          <span>«اسْأَلُوا تُعْطَوْا، اطْلُبُوا تَجِدُوا»</span>
          {quizResult && (
            <div className="flex items-center gap-1.5 text-amber-900 bg-amber-100/90 px-3 py-1.5 rounded-xl font-bold border border-amber-300 shadow-xs">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>تم تسجيل إجاباتك وتُحسب في لوحة المتصدرين</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

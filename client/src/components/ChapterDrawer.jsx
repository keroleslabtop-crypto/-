import React from 'react';
import { X, CheckCircle2, BookOpen, Clock, Award, PlayCircle } from 'lucide-react';

export default function ChapterDrawer({
  isOpen,
  onClose,
  chapters,
  activeChapterId,
  onSelectChapter,
  lastChapterId
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="chapter-drawer-title">
      {/* Backdrop with click outside */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm drawer-backdrop-enter"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 w-[88vw] max-w-md flex">
        <div id="chapter-drawer" className="chapter-drawer-panel w-full h-full bg-slate-900 border-l border-amber-800/40 shadow-2xl flex flex-col text-slate-100">
          
          {/* Drawer Header */}
          <div className="p-4 bg-slate-950/80 border-b border-amber-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl text-amber-400">✝</span>
              <div>
                <h2 id="chapter-drawer-title" className="text-base font-bold text-amber-200">فهرس الأصحاحات الـ ٢١</h2>
                <p className="text-xs text-amber-400/70">اختر أصحاحاً للقراءة والمشاهدة والاختبار</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition"
              aria-label="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chapters List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 overscroll-contain">
            {chapters.map((ch) => {
              const isActive = ch.id === activeChapterId;
              const isLastProgress = ch.id === lastChapterId;
              const isCompleted = ch.attempt && ch.attempt.score !== undefined;

              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    onSelectChapter(ch.id);
                    onClose();
                  }}
                  className={`w-full text-right p-3 rounded-xl border transition-all flex items-start gap-3 relative ${
                    isActive
                      ? 'bg-amber-900/30 border-amber-500/80 shadow-md ring-1 ring-amber-400/40'
                      : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/50 hover:border-amber-700/40'
                  }`}
                >
                  {/* Chapter number badge */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                    isActive 
                      ? 'bg-amber-500 text-slate-950'
                      : isCompleted
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50'
                      : 'bg-slate-700/80 text-amber-300'
                  }`}>
                    {ch.number}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-sm font-bold truncate ${isActive ? 'text-amber-200' : 'text-slate-200'}`}>
                        {ch.title}
                      </span>

                      {/* Status Badges */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isLastProgress && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            مكان توقفك 📍
                          </span>
                        )}
                        {isCompleted && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            {ch.attempt.score} د
                          </span>
                        )}
                      </div>
                    </div>

                    {ch.subtitle && (
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {ch.subtitle}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                      {ch.has_video && (
                        <span className="flex items-center gap-1 text-sky-400">
                          <PlayCircle className="w-3 h-3" />
                          فيديو
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-amber-300/80">
                        <Award className="w-3 h-3" />
                        {ch.question_count} أسئلة
                      </span>
                      {isCompleted && ch.attempt.time_spent_seconds && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3 h-3" />
                          {ch.attempt.time_spent_seconds} ثانية
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Drawer Footer */}
          <div className="p-3 bg-slate-950/80 border-t border-amber-900/40 text-center text-xs text-amber-400/80">
            «كَلِمَتُكَ مِصْبَاحٌ لِرِجْلِي وَنُورٌ لِسَبِيلِي» (مز ١١٩: ١٠٥)
          </div>

        </div>
      </div>
    </div>
  );
}

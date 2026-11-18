import React, { useState } from 'react';
import { BookOpen, Copy, Check, ZoomIn, ZoomOut, Edit3, Share2 } from 'lucide-react';

export default function ChapterReader({ 
  chapter, 
  currentUser, 
  onEditInAdmin 
}) {
  const [fontSize, setFontSize] = useState(20); // default comfortable reading size in px
  const [copied, setCopied] = useState(false);

  if (!chapter) {
    return (
      <div className="bg-amber-50/50 border border-amber-200/60 rounded-3xl p-12 text-center text-amber-800">
        جاري تحميل نص الأصحاح...
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(`${chapter.title}\n${chapter.text_content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section 
      aria-labelledby="chapter-reading-title"
      className="bg-[#fffefc] rounded-3xl border border-amber-900/15 shadow-xl overflow-hidden transition-all relative"
    >
      {/* Decorative Top Holy Accent Bar */}
      <div className="h-2 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-700" />

      {/* Reader Controls & Title Header */}
      <div className="p-4 sm:p-6 bg-gradient-to-b from-amber-100/40 to-transparent border-b border-amber-900/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-800 shrink-0 shadow-sm font-bold">
            <span className="text-xl">✝</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white text-xs font-bold">
                أصحاح {chapter.number}
              </span>
              <h2 id="chapter-reading-title" className="text-lg sm:text-xl font-extrabold text-stone-900">
                {chapter.title}
              </h2>
            </div>
            {chapter.subtitle && (
              <p className="text-xs sm:text-sm text-amber-900/80 mt-0.5 font-medium">
                {chapter.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Reader Action Controls */}
        <div className="flex items-center gap-1.5 bg-amber-100/50 p-1 rounded-2xl border border-amber-200/60 text-stone-700">
          <button
            onClick={() => setFontSize(Math.max(16, fontSize - 2))}
            className="p-1.5 rounded-xl hover:bg-white hover:text-amber-900 hover:shadow-xs transition"
            title="تصغير الخط"
            aria-label="تصغير الخط"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold px-1.5 text-stone-600 select-none">
            {fontSize}px
          </span>
          <button
            onClick={() => setFontSize(Math.min(32, fontSize + 2))}
            className="p-1.5 rounded-xl hover:bg-white hover:text-amber-900 hover:shadow-xs transition"
            title="تكبير الخط"
            aria-label="تكبير الخط"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-amber-300 mx-1" />

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-xl hover:bg-white hover:text-amber-900 hover:shadow-xs transition flex items-center gap-1 text-xs"
            title="نسخ نص الأصحاح"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span className="hidden md:inline">{copied ? 'تم النسخ' : 'نسخ'}</span>
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => onEditInAdmin(chapter.id)}
              className="p-1.5 rounded-xl bg-amber-600/20 text-amber-900 hover:bg-amber-600 hover:text-white transition flex items-center gap-1 text-xs font-bold"
              title="تعديل هذا الأصحاح من لوحة الأدمن"
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden md:inline">تعديل</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Scripture Text Body */}
      <div className="p-6 sm:p-8 md:p-10 bg-[#faf8f5]">
        <div 
          className="font-scripture leading-[2.1] text-stone-900 whitespace-pre-line tracking-wide selection:bg-amber-300 selection:text-amber-950"
          style={{ fontSize: `${fontSize}px` }}
        >
          {chapter.text_content}
        </div>
      </div>

      {/* Scripture Footer Accent */}
      <div className="px-6 py-3 bg-amber-50/70 border-t border-amber-900/10 flex items-center justify-between text-xs text-amber-900/70">
        <span className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-amber-700" />
          اقرأ بتأنٍ وصلّ قبل أن تبدأ بحل الاختبار
        </span>
        <span className="text-[11px] font-semibold">
          عدد الآيات والكلمات مباركة
        </span>
      </div>
    </section>
  );
}

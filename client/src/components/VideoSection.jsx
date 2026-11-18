import React from 'react';
import { PlayCircle, Video, ExternalLink, Edit3, Tv } from 'lucide-react';

function getEmbedUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();

  // YouTube watch link
  const ytWatchMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytWatchMatch && ytWatchMatch[1]) {
    return `https://www.youtube.com/embed/${ytWatchMatch[1]}?rel=0`;
  }

  // Already embed format
  if (trimmed.includes('youtube.com/embed/')) {
    return trimmed;
  }

  // Use Drive's embedded player rather than its share page.
  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if (driveFileMatch) {
    return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
  }

  return trimmed;
}

export default function VideoSection({ 
  chapter, 
  currentUser, 
  onEditInAdmin 
}) {
  const embedUrl = getEmbedUrl(chapter?.video_url);
  const isDirectVideo = embedUrl && (embedUrl.endsWith('.mp4') || embedUrl.endsWith('.webm'));
  const isGoogleDriveVideo = embedUrl?.includes('drive.google.com/file/d/');

  return (
    <section 
      aria-labelledby="video-section-title"
      className="bg-[#fffefc] rounded-2xl sm:rounded-3xl border border-amber-900/15 shadow-xl overflow-hidden"
    >
      {/* Video Section Header */}
      <div className="p-3 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-amber-50 flex flex-col min-[480px]:flex-row min-[480px]:items-center justify-between gap-3">
        <div className="flex items-start min-w-0 gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Tv className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="video-section-title" className="text-sm sm:text-base font-bold text-amber-200 leading-snug break-words line-clamp-2">
              {chapter?.video_title || `شرح وتأمل فيديو - ${chapter?.title}`}
            </h3>
            <p className="text-xs text-amber-400/70">شاهد الفيديو لتعميق فهمك للأصحاح قبل بدء الاختبار</p>
          </div>
        </div>

        {currentUser?.role === 'admin' && (
          <button
            onClick={() => onEditInAdmin(chapter?.id)}
            className="self-start min-h-10 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 border border-amber-500/30 transition"
            title="تعديل رابط الفيديو من لوحة الأدمن"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>تعديل الفيديو</span>
          </button>
        )}
      </div>

      {/* Video Player Display Container */}
      <div className="p-2 sm:p-6 bg-slate-950 flex flex-col items-center justify-center">
        {embedUrl ? (
          <div className="w-full max-w-4xl aspect-video rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl bg-black border border-slate-800 relative">
            {isDirectVideo ? (
              <video 
                src={embedUrl} 
                controls 
                className="w-full h-full object-contain"
                preload="metadata"
                playsInline
                webkit-playsinline="true"
              >
                متصفحك لا يدعم تشغيل هذا الفيديو.
              </video>
            ) : (
              <>
                <iframe
                  src={embedUrl}
                  title={chapter?.video_title || 'فيديو شرح الأصحاح'}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                />
              </>
            )}
          </div>
        ) : (
          <div className="w-full max-w-2xl py-12 px-6 rounded-2xl bg-slate-900/80 border border-dashed border-amber-800/40 text-center flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-amber-500">
              <Video className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-200">لا يوجد فيديو مضاف لهذا الأصحاح حالياً</p>
              <p className="text-xs text-slate-400 mt-1">
                يمكن للأدمن إضافة أو رفع رابط فيديو لشرح الأصحاح في أي وقت من لوحة الإدارة.
              </p>
            </div>
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => onEditInAdmin(chapter?.id)}
                className="mt-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Edit3 className="w-4 h-4" />
                إضافة رابط فيديو للأصحاح الآن
              </button>
            )}
          </div>
        )}
      </div>

      {/* Video Footer Note */}
      <div className="px-4 sm:px-6 py-3 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-400 leading-relaxed">
        <span className="min-w-0 flex items-start sm:items-center gap-1 text-amber-400/80">
          <PlayCircle className="w-3.5 h-3.5" />
          تأمل كلمة الله وسلّم كل فكر لطاعة المسيح
        </span>
        {chapter?.video_url && !isGoogleDriveVideo && (
          <a 
            href={chapter.video_url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-1 text-sky-400 hover:underline"
          >
            <span>فتح في نافذة جديدة</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </section>
  );
}

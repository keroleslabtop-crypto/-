import React, { useEffect, useRef, useState } from 'react';
import { PlayCircle, Video, Edit3, Tv, Maximize2 } from 'lucide-react';
import { apiRequest } from '../api';

function configureYouTubeEmbed(url) {
  if (!url || !/youtube(?:-nocookie)?\.com\/embed\//i.test(url)) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('rel', '0');
    parsed.searchParams.set('playsinline', '1');
    parsed.searchParams.set('iv_load_policy', '3');
    parsed.searchParams.set('modestbranding', '1');
    return parsed.toString();
  } catch {
    return url;
  }
}

function getEmbedUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();

  // YouTube watch link
  const ytWatchMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytWatchMatch && ytWatchMatch[1]) {
    return configureYouTubeEmbed(`https://www.youtube.com/embed/${ytWatchMatch[1]}`);
  }

  // Already embed format
  if (trimmed.includes('youtube.com/embed/')) {
    return configureYouTubeEmbed(trimmed);
  }

  // Use Drive's embedded player rather than its share page.
  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if (driveFileMatch) {
    return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
  }

  // Google Drive links using open?id= or uc?id=
  if (/drive\.google\.com/i.test(trimmed)) {
    try {
      const driveUrl = new URL(trimmed);
      const fileId = driveUrl.searchParams.get('id');
      if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;
    } catch {
      // Keep the original link if it cannot be parsed.
    }
  }

  return trimmed;
}

export default function VideoSection({ 
  chapter, 
  currentUser, 
  onEditInAdmin 
}) {
  const playerRef = useRef(null);
  const isPrivateSupabaseVideo = chapter?.video_url?.startsWith('supabase://');
  const [privateVideoUrl, setPrivateVideoUrl] = useState('');
  const [privateVideoError, setPrivateVideoError] = useState('');
  const [privateVideoLoading, setPrivateVideoLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!isPrivateSupabaseVideo || !chapter?.id) {
      setPrivateVideoUrl('');
      setPrivateVideoError('');
      setPrivateVideoLoading(false);
      return () => { active = false; };
    }

    setPrivateVideoUrl('');
    setPrivateVideoError('');
    setPrivateVideoLoading(true);
    apiRequest(`/chapters/${chapter.id}/video-url`)
      .then((result) => {
        if (active) setPrivateVideoUrl(result.video_url || '');
      })
      .catch((error) => {
        if (active) setPrivateVideoError(error.message || 'تعذر تحميل الفيديو الخاص');
      })
      .finally(() => {
        if (active) setPrivateVideoLoading(false);
      });

    return () => { active = false; };
  }, [chapter?.id, chapter?.video_url, isPrivateSupabaseVideo]);

  const embedUrl = getEmbedUrl(isPrivateSupabaseVideo ? privateVideoUrl : chapter?.video_url);
  const isDirectVideo = (() => {
    if (!embedUrl) return false;
    try {
      return /\.(mp4|webm)$/i.test(new URL(embedUrl).pathname);
    } catch {
      return /\.(mp4|webm)(?:\?|$)/i.test(embedUrl);
    }
  })();
  const isGoogleDriveVideo = embedUrl?.includes('drive.google.com/file/d/');
  const isProtonDriveVideo = (() => {
    try {
      return new URL(embedUrl).hostname === 'drive.proton.me';
    } catch {
      return false;
    }
  })();

  const openFullscreen = async () => {
    const media = playerRef.current?.querySelector('video, iframe');
    if (media instanceof HTMLVideoElement && typeof media.webkitEnterFullscreen === 'function') {
      media.webkitEnterFullscreen();
      return;
    }

    const player = playerRef.current;
    if (typeof player?.requestFullscreen !== 'function') {
      return;
    }

    try {
      await player.requestFullscreen();
    } catch (error) {
      console.warn('Fullscreen is unavailable for this video:', error);
    }
  };

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
      <div className="p-0 sm:p-6 bg-slate-950 flex flex-col items-center justify-center">
        {embedUrl ? (
          <div ref={playerRef} className="video-player-shell w-full max-w-[430px] aspect-[9/16] sm:max-w-4xl sm:aspect-[16/9] rounded-lg sm:rounded-2xl overflow-hidden shadow-2xl bg-black border border-slate-800 relative">
            {isDirectVideo ? (
              <video 
                src={embedUrl} 
                controls 
                className="absolute inset-0 w-full h-full object-contain"
                preload="metadata"
                playsInline
                webkit-playsinline="true"
              >
                متصفحك لا يدعم تشغيل هذا الفيديو.
              </video>
            ) : isProtonDriveVideo ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 px-5 text-center">
                <Video className="h-12 w-12 text-amber-400" />
                <p className="text-sm font-semibold text-amber-100">رابط Proton Drive لا يدعم تشغيل الفيديو داخل الموقع.</p>
                <p className="text-xs text-slate-300">استخدم تخزين Supabase الخاص لتشغيل الفيديو داخل الموقع.</p>
              </div>
            ) : (
              <>
                <iframe
                  src={embedUrl}
                  title={chapter?.video_title || 'فيديو شرح الأصحاح'}
                  className="absolute inset-0 w-full h-full border-0"
                  sandbox={isGoogleDriveVideo ? 'allow-scripts allow-same-origin allow-popups' : undefined}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading={isGoogleDriveVideo ? 'eager' : 'lazy'}
                />
              </>
            )}
          </div>
        ) : isPrivateSupabaseVideo ? (
          <div className="w-full max-w-[430px] aspect-[9/16] sm:max-w-4xl sm:aspect-[16/9] rounded-lg sm:rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-3 p-5 text-center">
            <Video className="w-10 h-10 text-amber-400" />
            <p className="text-sm font-semibold text-amber-100">
              {privateVideoLoading ? 'جاري تجهيز الفيديو...' : privateVideoError || 'تعذر تحميل الفيديو الخاص'}
            </p>
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
        {embedUrl && chapter?.video_url && (
          <div className="grid grid-cols-1 gap-2 w-full max-w-4xl mt-2 sm:hidden">
            <button
              type="button"
              onClick={openFullscreen}
              className="min-h-11 w-full px-2 py-2 rounded-xl border border-amber-500/40 bg-slate-900 text-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
              aria-label="تكبير شاشة الفيديو"
            >
              <Maximize2 className="w-4 h-4 shrink-0" />
              <span>تكبير الشاشة</span>
            </button>
          </div>
        )}
      </div>

      {/* Video Footer Note */}
      <div className="px-4 sm:px-6 py-3 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-400 leading-relaxed">
        <span className="min-w-0 flex items-start sm:items-center gap-1 text-amber-400/80">
          <PlayCircle className="w-3.5 h-3.5" />
          تأمل كلمة الله وسلّم كل فكر لطاعة المسيح
        </span>
      </div>
    </section>
  );
}

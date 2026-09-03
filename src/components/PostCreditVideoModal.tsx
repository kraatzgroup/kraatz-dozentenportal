import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { usePostCreditVideo, POST_CREDIT_VIDEO_URL } from '../hooks/usePostCreditVideo';

/**
 * Full-screen video modal shown after a user:
 *  1. Received the test credit (Sonderangebot)
 *  2. Opened the correction of their first Sachverhalt
 *  3. Did not purchase additional credits within 24 hours
 *
 * The modal has a dark background, locks body scroll, and shows the video
 * without any player controls. It tracks how long the user watched (in
 * seconds) before closing, then persists that to the database so the video
 * is never shown again.
 */
export const PostCreditVideoModal: React.FC = () => {
  const { shouldShow, loading, dismiss } = usePostCreditVideo();
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [muted, setMuted] = useState(true);

  // Lock body scroll while the modal is open
  useEffect(() => {
    if (!shouldShow || loading) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [shouldShow, loading]);

  // Start muted to satisfy browser autoplay policies, then try to
  // unmute after a short delay (works if the user interacted via login)
  useEffect(() => {
    if (!shouldShow || loading) return;
    const timer = setTimeout(() => {
      const v = videoRef.current;
      if (!v) return;
      v.muted = false;
      v.play().then(() => {
        setMuted(false);
      }).catch(() => {
        // Unmute blocked — stay muted, user can click to unmute
        v.muted = true;
        setMuted(true);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [shouldShow, loading]);

  // Record start time when video begins playing
  const handlePlay = () => {
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
  };

  const handleClose = async (redirect = false) => {
    if (closing) return;
    setClosing(true);

    // Calculate watch duration
    let watchSeconds = 0;
    if (startTimeRef.current !== null) {
      watchSeconds = (Date.now() - startTimeRef.current) / 1000;
    }
    // If video element has a currentTime, use the larger of the two
    // (more accurate if the user paused/resumed)
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      watchSeconds = Math.max(watchSeconds, currentTime);
    }

    await dismiss(watchSeconds);
    setClosing(false);

    if (redirect) {
      window.location.href = '/klausurenbesprechung/pakete';
    }
  };

  if (loading || !shouldShow) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onClick={(e) => {
        // Only close when clicking the dark backdrop, not the video itself
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      {/* Close button */}
      <button
        onClick={() => handleClose()}
        className="absolute top-4 right-4 z-[101] p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        title="Video schließen"
        aria-label="Video schließen"
      >
        <X className="h-7 w-7" />
      </button>

      {/* Video — starts muted (autoplay policy), unmutes after 500ms */}
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <video
          ref={videoRef}
          src={POST_CREDIT_VIDEO_URL}
          autoPlay
          muted={muted}
          playsInline
          controls={false}
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          onClick={(e) => {
            e.stopPropagation();
            // Click on video toggles mute
            const v = videoRef.current;
            if (v) {
              v.muted = !v.muted;
              setMuted(v.muted);
            }
          }}
          onPlay={handlePlay}
          onEnded={() => handleClose(true)}
          className="max-w-full max-h-full object-contain cursor-pointer"
          style={{ outline: 'none' }}
        />
        {muted && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 1 }}
          >
            <div className="bg-black/60 text-white px-6 py-3 rounded-lg text-sm">
              Klicken, um Ton anzuschalten
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

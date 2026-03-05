import React, { useEffect, useState } from 'react';
import { Language } from '../types';
import { t } from '../utils/i18n';

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  frozenImage?: string | null;
  language: Language;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ videoRef, frozenImage, language }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const constraints = {
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.log("Play failed, waiting for user interaction or metadata", e));
          setHasPermission(true);
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        setHasPermission(false);
      }
    };

    if (!frozenImage) {
        startCamera();
    }

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoRef, frozenImage]);

  const handleCanPlay = () => {
      if (videoRef.current) {
          videoRef.current.play().catch(e => console.error("Autoplay failed:", e));
      }
  };

  if (hasPermission === false) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-[var(--bg)] text-[var(--text)] p-8 text-center">
        <div className="max-w-xs">
          <div className="w-16 h-16 rounded-full border border-primary/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-primary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl mb-3">{t('camera.permissionTitle', language)}</h2>
          <p className="text-sm text-secondary leading-relaxed">{t('camera.permissionDesc', language)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full bg-black touch-none">
      {/* Live Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={handleCanPlay}
        className={`absolute top-0 left-0 w-full h-full object-cover ${frozenImage ? 'hidden' : 'block'}`}
      />

      {/* Frozen Image Overlay */}
      {frozenImage && (
        <img
            src={frozenImage}
            alt="Frozen Frame"
            className="absolute top-0 left-0 w-full h-full object-cover"
        />
      )}

      {/* Gradient Overlay — warm tint */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0a0a0a]/90 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#0a0a0a]/60 to-transparent pointer-events-none" />
    </div>
  );
};

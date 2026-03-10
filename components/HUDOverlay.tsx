import React, { useRef, useState, useCallback } from 'react';
import { Language } from '../types';
import { t } from '../utils/i18n';

interface HUDOverlayProps {
  isScanning: boolean;
  onScan: () => void;
  onUpload: (file: File) => void;
  hasResult: boolean;
  language: Language;
  onHistoryClick: () => void;
  historyCount: number;
  onSettingsClick: () => void;
  onGalleryClick?: () => void;
  children: React.ReactNode;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  isScanning,
  onScan,
  onUpload,
  hasResult,
  language,
  onHistoryClick,
  historyCount,
  onSettingsClick,
  onGalleryClick,
  children
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isShutterDisabled, setIsShutterDisabled] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleScan = useCallback(() => {
    if (isShutterDisabled || isScanning) return;
    setIsShutterDisabled(true);
    onScan();
    // Re-enable after 2s
    setTimeout(() => setIsShutterDisabled(false), 2000);
  }, [isShutterDisabled, isScanning, onScan]);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between overflow-hidden h-dvh">

      {/* Top Bar */}
      <div className="w-full pt-safe-top mt-4 px-5 flex items-start justify-between z-20 pointer-events-auto">

        <div className="flex gap-2">
          {/* History Button */}
          <button
            onClick={onHistoryClick}
            className="relative p-3 rounded-full warm-glass text-[var(--text)] hover:border-primary/30 transition-all duration-300 active:scale-95"
            aria-label="History"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {historyCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-onPrimary text-[10px] font-mono font-bold rounded-full flex items-center justify-center">
                {historyCount > 9 ? '9+' : historyCount}
              </span>
            )}
          </button>

          {/* Gallery Button */}
          {onGalleryClick && (
            <button
              onClick={onGalleryClick}
              className="p-3 rounded-full warm-glass text-[var(--text)] hover:border-primary/30 transition-all duration-300 active:scale-95"
              aria-label="Gallery"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </button>
          )}
        </div>

        {/* App Badge */}
        <div className={`warm-glass px-4 py-1.5 rounded-full flex items-center gap-2 transition-all duration-500 ${hasResult ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          <div className="flex gap-0.5">
            <div className="w-1 h-1 rounded-full bg-gRed" />
            <div className="w-1 h-1 rounded-full bg-gYellow" />
            <div className="w-1 h-1 rounded-full bg-gGreen" />
            <div className="w-1 h-1 rounded-full bg-gBlue" />
          </div>
          <span className="text-xs font-serif text-[var(--text)] tracking-wide">AI Academy</span>
        </div>

        {/* Settings Gear */}
        <button
          onClick={onSettingsClick}
          className="p-3 rounded-full warm-glass text-secondary hover:text-primary hover:border-primary/30 transition-all duration-300 active:scale-95"
          aria-label="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Main Viewfinder Area */}
      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${hasResult ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>

        {/* Gold Corner Bracket Reticle — responsive sizing */}
        {!isScanning && (
          <div className="relative w-[60vw] max-w-[280px] aspect-square transition-all duration-500">
            {/* Corners — gold */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-[1.5px] border-l-[1.5px] border-primary/60 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-[1.5px] border-r-[1.5px] border-primary/60 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[1.5px] border-l-[1.5px] border-primary/60 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[1.5px] border-r-[1.5px] border-primary/60 rounded-br-lg" />

            {/* Center crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-5 h-[1px] bg-primary/40" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-5 bg-primary/40" />
            </div>
          </div>
        )}

        {/* Scanning State — gold sweep line */}
        {isScanning && (
          <div className="relative w-[60vw] max-w-[280px] aspect-square overflow-hidden">
            {/* Corner brackets remain during scan */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-[1.5px] border-l-[1.5px] border-primary/80 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-[1.5px] border-r-[1.5px] border-primary/80 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[1.5px] border-l-[1.5px] border-primary/80 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[1.5px] border-r-[1.5px] border-primary/80 rounded-br-lg" />

            {/* Scanning line */}
            <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
          </div>
        )}
      </div>

      {/* Bottom Interface Layer */}
      <div className="relative w-full h-full z-30 pointer-events-none">

        {/* Result Card Container */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end p-4 pb-safe-bottom">
            {children}
        </div>

        {/* Shutter & Upload Buttons */}
        {!hasResult && (
          <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center pb-safe-bottom pointer-events-auto transition-all duration-300 transform">

            {/* Upload Input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />

            {/* Shutter Button — gold ring */}
            <button
              onClick={handleScan}
              disabled={isScanning || isShutterDisabled}
              className={`relative flex items-center justify-center rounded-full transition-all duration-300 z-10
                ${isScanning
                  ? 'w-16 h-16 scale-95 cursor-wait'
                  : 'w-20 h-20 hover:scale-105 active:scale-95'
                }`}
            >
              {/* Outer Ring — gold */}
              <div className={`absolute inset-0 rounded-full border-[3px] transition-colors duration-300 ${isScanning ? 'border-primary/40' : 'border-primary'}`} />

              {/* Inner Circle */}
              <div className={`rounded-full transition-all duration-300 ${isScanning ? 'w-8 h-8 bg-primary/60 rounded-md' : 'w-16 h-16 bg-[var(--text)]/90'}`} />

              {/* Glow on idle */}
              {!isScanning && (
                <div className="absolute inset-0 rounded-full animate-glow-pulse" />
              )}
            </button>

            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className={`absolute right-8 sm:right-16 p-3.5 rounded-full warm-glass text-[var(--text)] hover:border-primary/30 transition-all duration-300 active:scale-95
                  ${isScanning ? 'opacity-0 pointer-events-none' : 'opacity-100'}
              `}
              aria-label="Upload Image"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            <p className="absolute -bottom-8 text-center text-xs font-medium text-secondary/70 tracking-wide w-full">
              {isScanning ? t('hud.analyzing', language) : t('hud.tapToIdentify', language)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

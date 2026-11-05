import React, { useState, useCallback } from 'react';
import { Language } from '../types';
import { t, tf } from '../utils/i18n';

interface HUDOverlayProps {
  isScanning: boolean;
  onScan: () => void;
  /** Recent captures (newest first, up to 3) shown as small overlapping photos next to the shutter; null before the first scan. */
  lastCapture?: { recent: string[]; count: number } | null;
  /** Reopen earlier captures and everything done with them. */
  onOpenCaptures?: () => void;
  hasResult: boolean;
  language: Language;
  /** Visitor's game points; null while unknown (hides the pill). */
  points: number | null;
  onPointsClick: () => void;
  /** Space reserved at the bottom for the tab bar, in px. */
  bottomInset?: number;
  children: React.ReactNode;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  isScanning,
  onScan,
  lastCapture = null,
  onOpenCaptures,
  hasResult,
  language,
  points,
  onPointsClick,
  bottomInset = 0,
  children
}) => {
  const [isShutterDisabled, setIsShutterDisabled] = useState(false);

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
      <div className="w-full pt-safe-top mt-4 px-5 flex items-center justify-between z-20 pointer-events-auto">

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

        {/* Points — opens Missions */}
        {points !== null && (
          <button
            type="button"
            onClick={onPointsClick}
            className="warm-glass h-11 px-4 rounded-full flex items-center gap-1.5 text-[var(--text)] active:scale-95 transition-transform"
            aria-label={`${points} ${t('points.unit', language)} · ${t('nav.missions', language)}`}
          >
            <span className="font-mono tabular text-base">{points}</span>
            <span className="text-xs text-secondary">{t('points.unit', language)}</span>
          </button>
        )}
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
        <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end p-4 pb-safe-bottom" style={{ bottom: bottomInset }}>
            {children}
        </div>

        {/* Shutter + last capture (camera only: nothing is uploaded from the device) */}
        {!hasResult && (
          <div className="absolute left-0 right-0 flex items-center justify-center pb-safe-bottom pointer-events-auto transition-all duration-300 transform" style={{ bottom: bottomInset + 48 }}>

            {/* Shutter Button — gold ring */}
            <button
              type="button"
              onClick={handleScan}
              disabled={isScanning || isShutterDisabled}
              aria-label={isScanning ? t('hud.analyzing', language) : t('hud.tapToIdentify', language)}
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

            </button>

            {/* Recent captures as small overlapping photos: reopens earlier artworks with their narration, chat and quiz */}
            {lastCapture && onOpenCaptures && (
              <button
                type="button"
                onClick={onOpenCaptures}
                disabled={isScanning}
                aria-label={tf('captures.open', language, { n: lastCapture.count })}
                className={`absolute right-5 sm:right-14 h-14 flex items-center active:scale-95 transition-all duration-300
                  ${isScanning ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                style={{ width: 44 + (lastCapture.recent.length - 1) * 14 + 8 }}
              >
                {/* oldest first, so the newest sits on top at the right */}
                {[...lastCapture.recent].reverse().map((src, i, arr) => (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    width={44}
                    height={44}
                    draggable={false}
                    className="absolute w-11 h-11 rounded-xl object-cover border-2 border-[var(--bg)] bg-[var(--surface)] shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
                    style={{ left: i * 14, transform: `rotate(${(i - (arr.length - 1)) * 6}deg)`, zIndex: i }}
                  />
                ))}
                {lastCapture.count > 1 && (
                  <span className="absolute -top-1 right-0 z-10 min-w-[20px] h-5 px-1 rounded-full bg-primary-dark text-onPrimary font-mono tabular text-xs leading-5 text-center">
                    {lastCapture.count}
                  </span>
                )}
              </button>
            )}

            <p className="absolute -bottom-8 text-center text-xs font-medium text-secondary/70 tracking-wide w-full">
              {isScanning ? t('hud.analyzing', language) : t('hud.tapToIdentify', language)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

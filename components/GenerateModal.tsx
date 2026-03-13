import React, { useState, useEffect, useRef } from 'react';
import { IdentifyResponse, Language, GeneratedImage } from '../types';
import { apiPost, apiFetch } from '../services/apiClient';
import { t } from '../utils/i18n';
import { addWatermark, shareOrDownload } from '../utils/shareCard';

interface GenerateModalProps {
  artData: IdentifyResponse;
  language: Language;
  onClose: () => void;
  onSaved: (image: GeneratedImage) => void;
}

type ModalState = 'generating' | 'result' | 'error';

const PROGRESS_MESSAGES: Record<Language, string[]> = {
  en: ['Analyzing art style...', 'Composing portrait...', 'Adding final touches...'],
  pt: ['Analisando estilo artístico...', 'Compondo retrato...', 'Adicionando toques finais...'],
  es: ['Analizando estilo artístico...', 'Componiendo retrato...', 'Añadiendo toques finales...'],
};

export const GenerateModal: React.FC<GenerateModalProps> = ({
  artData,
  language,
  onClose,
  onSaved,
}) => {
  const [state, setState] = useState<ModalState>('generating');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [progressIdx, setProgressIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  // Cycle progress messages
  useEffect(() => {
    if (state !== 'generating') return;
    const timer = setInterval(() => {
      setProgressIdx(prev => {
        const msgs = PROGRESS_MESSAGES[language] || PROGRESS_MESSAGES.en;
        return prev < msgs.length - 1 ? prev + 1 : prev;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [state, language]);

  // Trigger generation on mount
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const generate = async () => {
      try {
        const result = await apiPost<{ imageId: string; imageUrl: string; prompt: string }>(
          '/api/generate-image',
          {
            artworkTitle: artData.title,
            artworkArtist: artData.artist,
            artworkStyle: artData.style,
            artworkYear: artData.year,
          }
        );
        setImageUrl(result.imageUrl);
        setImageId(result.imageId);
        setState('result');
      } catch (err: any) {
        console.error('Image generation failed:', err);
        setErrorMsg(err.message || t('generate.error', language));
        setState('error');
      }
    };

    generate();
  }, [artData, language]);

  const handleRetry = () => {
    hasStartedRef.current = false;
    setProgressIdx(0);
    setState('generating');
    // Re-trigger by resetting ref — useEffect won't re-run because deps haven't changed,
    // so we manually call the generate function
    const generate = async () => {
      try {
        const result = await apiPost<{ imageId: string; imageUrl: string; prompt: string }>(
          '/api/generate-image',
          {
            artworkTitle: artData.title,
            artworkArtist: artData.artist,
            artworkStyle: artData.style,
            artworkYear: artData.year,
          }
        );
        setImageUrl(result.imageUrl);
        setImageId(result.imageId);
        setState('result');
      } catch (err: any) {
        console.error('Image generation failed:', err);
        setErrorMsg(err.message || t('generate.error', language));
        setState('error');
      }
    };
    generate();
  };

  const handleSave = () => {
    if (!imageUrl || !imageId) return;
    onSaved({
      id: imageId,
      scanId: '',
      artworkTitle: artData.title,
      artworkArtist: artData.artist,
      imageUrl,
      prompt: '',
      createdAt: Date.now(),
    });
    onClose();
  };

  const handleDownload = async () => {
    if (!imageUrl) return;
    try {
      const blob = await addWatermark(imageUrl);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `artlens-${artData.title.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  const handleShare = async () => {
    if (!imageUrl) return;
    try {
      const blob = await addWatermark(imageUrl);
      const filename = `artlens-portrait-${artData.title.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
      await shareOrDownload(
        blob,
        filename,
        t('generate.title', language),
        `My portrait in the style of "${artData.title}" by ${artData.artist} — AI Leadership Academy`,
      );
    } catch { /* user cancelled */ }
  };

  const progressMessages = PROGRESS_MESSAGES[language] || PROGRESS_MESSAGES.en;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-colors z-10"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="w-full max-w-sm mx-4">
        {/* Generating State */}
        {state === 'generating' && (
          <div className="flex flex-col items-center text-center space-y-8 animate-fade-in">
            {/* Animated sparkle icon */}
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse" />
              <div className="absolute inset-2 rounded-full border border-primary/30 animate-spin" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
            </div>

            <div>
              <p className="font-serif text-xl text-white mb-2">{t('generate.generating', language)}</p>
              <p className="text-sm text-white/50 transition-opacity duration-500">
                {progressMessages[progressIdx]}
              </p>
            </div>

            <p className="text-xs text-white/30 font-mono">
              {artData.title} · {artData.artist}
            </p>
          </div>
        )}

        {/* Result State */}
        {state === 'result' && imageUrl && (
          <div className="flex flex-col items-center space-y-6 animate-fade-in">
            <p className="font-serif text-lg text-white">{t('generate.title', language)}</p>

            {/* Generated image */}
            <div className="w-full aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <img
                src={imageUrl}
                alt="Generated portrait"
                className="w-full h-full object-cover"
              />
            </div>

            <p className="text-xs text-white/40 font-mono text-center">
              In the style of "{artData.title}" by {artData.artist}
            </p>

            {/* Action buttons */}
            <div className="flex gap-3 w-full">
              <button
                onClick={handleSave}
                className="flex-1 py-3 rounded-full bg-primary text-onPrimary font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {t('generate.save', language)}
              </button>
              <button
                onClick={handleDownload}
                className="p-3 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors"
                aria-label={t('generate.download', language)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onClick={handleShare}
                className="p-3 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors"
                aria-label={t('result.share', language)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {state === 'error' && (
          <div className="flex flex-col items-center text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-sm text-white/70">{errorMsg || t('generate.error', language)}</p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 rounded-full border border-primary/30 text-primary text-sm hover:bg-primary/10 transition-all duration-300"
            >
              {t('generate.retry', language)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

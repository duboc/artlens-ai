import React, { useState, useEffect } from 'react';
import { Language, GeneratedImage } from '../types';
import { apiGet, apiFetch } from '../services/apiClient';
import { t } from '../utils/i18n';

interface GalleryProps {
  isOpen: boolean;
  language: Language;
  onClose: () => void;
}

export const Gallery: React.FC<GalleryProps> = ({ isOpen, language, onClose }) => {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    apiGet<{ images: GeneratedImage[] }>('/api/generate-image')
      .then(res => setImages(res.images || []))
      .catch(err => {
        console.error('Failed to load gallery:', err);
        setImages([]);
      })
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const handleDownload = async (image: GeneratedImage) => {
    try {
      const response = await apiFetch(image.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `artlens-${image.artworkTitle.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(image.imageUrl, '_blank');
    }
  };

  const handleShare = async (image: GeneratedImage) => {
    try {
      const response = await apiFetch(image.imageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'artlens-portrait.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: image.artworkTitle,
          text: `My portrait in the style of "${image.artworkTitle}" by ${image.artworkArtist}`,
          files: [file],
        });
      } else if (navigator.share) {
        await navigator.share({
          title: image.artworkTitle,
          text: `My portrait in the style of "${image.artworkTitle}" by ${image.artworkArtist}`,
        });
      }
    } catch {
      /* user cancelled */
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-safe pb-4 border-b border-[var(--primary-dim)] shrink-0">
        <div className="pt-4">
          <h2 className="font-serif text-xl text-[var(--text)]">{t('gallery.title', language)}</h2>
          {images.length > 0 && (
            <p className="text-xs text-secondary font-mono mt-1">{images.length} portrait{images.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-[var(--surface-variant)] hover:bg-secondary/20 text-secondary transition-colors mt-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4">
        {isLoading ? (
          /* Loading skeleton */
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-square rounded-2xl bg-[var(--surface)] animate-pulse" />
            ))}
          </div>
        ) : images.length === 0 ? (
          /* Empty state */
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-20 h-20 rounded-full border border-[var(--primary-dim)] flex items-center justify-center mb-6">
              <svg className="w-9 h-9 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <p className="font-serif text-lg text-[var(--text)] mb-2">{t('gallery.empty', language)}</p>
            <p className="text-sm text-secondary/60">{t('gallery.emptyDesc', language)}</p>
          </div>
        ) : (
          /* Image grid */
          <div className="grid grid-cols-2 gap-3">
            {images.map(image => (
              <button
                key={image.id}
                onClick={() => setSelectedImage(image)}
                className="group relative aspect-square rounded-2xl overflow-hidden border border-[var(--primary-dim)] bg-[var(--surface)] transition-all duration-300 hover:border-primary/30 active:scale-[0.97]"
              >
                <img
                  src={image.imageUrl}
                  alt={image.artworkTitle}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                  <p className="text-white text-xs font-serif truncate">{image.artworkTitle}</p>
                  <p className="text-white/50 text-[10px] font-mono truncate">{image.artworkArtist}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail View Overlay */}
      {selectedImage && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
          {/* Close detail */}
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-colors z-10"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="w-full max-w-sm mx-4 space-y-6">
            {/* Full image */}
            <div className="w-full aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <img
                src={selectedImage.imageUrl}
                alt={selectedImage.artworkTitle}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Info */}
            <div className="text-center">
              <p className="font-serif text-lg text-white">{selectedImage.artworkTitle}</p>
              <p className="text-xs text-white/40 font-mono mt-1">{selectedImage.artworkArtist}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => handleDownload(selectedImage)}
                className="px-6 py-3 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('generate.download', language)}
              </button>
              <button
                onClick={() => handleShare(selectedImage)}
                className="px-6 py-3 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {t('result.share', language)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

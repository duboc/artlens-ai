import React, { useState, useEffect } from 'react';
import { Annotation, Language } from '../types';
import { t } from '../utils/i18n';

interface AnnotationCardProps {
  annotation: Annotation;
  annotations: Annotation[];
  language: Language;
  onClose: () => void;
  onNavigate: (annotation: Annotation) => void;
}

export const AnnotationCard: React.FC<AnnotationCardProps> = ({ annotation, annotations, language, onClose, onNavigate }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    setIsExpanded(true);
  }, [annotation.id]);

  const currentIndex = annotations.findIndex(a => a.id === annotation.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < annotations.length - 1;

  const goPrev = () => {
    if (hasPrev) onNavigate(annotations[currentIndex - 1]);
  };
  const goNext = () => {
    if (hasNext) onNavigate(annotations[currentIndex + 1]);
  };

  return (
    <div className="w-full pointer-events-auto transition-all duration-300 ease-out animate-slide-up z-50">
      {/* Backdrop */}
      {isExpanded && (
        <div className="fixed inset-0 bg-[var(--bg)]/30 backdrop-blur-sm -z-10" onClick={() => setIsExpanded(false)} />
      )}

      {/* Card */}
      <div
        className={`bg-[var(--surface)]/95 backdrop-blur-xl border-t border-x border-[var(--primary-dim)] rounded-t-[2rem] shadow-2xl relative overflow-hidden transition-all duration-300
          ${isExpanded ? 'pb-8' : 'pb-6'}
        `}
      >
        {/* Gold gradient top bar */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        {/* Drag Handle */}
        <div
            className="w-full flex flex-col items-center pt-3 pb-2 cursor-pointer active:opacity-70"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="w-12 h-1 bg-secondary/20 rounded-full" />
        </div>

        <div className="px-6">
          {/* Header Row */}
          <div className="flex justify-between items-start gap-4 mb-3">
            <div
              className="flex-1 cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <h3 className="font-serif text-[var(--text)] text-lg leading-tight">{annotation.label}</h3>
              <p className="font-mono text-primary/60 text-xs uppercase tracking-[0.15em] mt-1">
                {t('annotation.detailView', language)} {currentIndex + 1}/{annotations.length}
              </p>
            </div>

            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="p-2 -mr-2 text-secondary hover:text-[var(--text)] bg-[var(--surface-variant)] hover:bg-secondary/20 rounded-full transition-colors duration-300 flex-shrink-0"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Content Area */}
          <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-64 opacity-100 mb-6' : 'max-h-0 opacity-0'}`}>
            <p
              key={annotation.id}
              className="text-[var(--text)]/80 text-sm leading-relaxed animate-fade-in"
            >
              {annotation.description}
            </p>
          </div>

          {/* Actions — prev/next + toggle */}
          <div className="flex gap-3">
            {/* Prev */}
            <button
              onClick={goPrev}
              disabled={!hasPrev}
              className="w-10 h-10 rounded-full border border-[var(--primary-dim)] flex items-center justify-center text-secondary hover:text-primary hover:border-primary/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>

            {/* Toggle */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-1 py-3 rounded-xl text-sm font-medium border border-[var(--primary-dim)] text-secondary hover:text-primary hover:border-primary/30 transition-all duration-300 flex items-center justify-center gap-2"
            >
              {isExpanded ? (
                <>
                  <span>{t('annotation.showLess', language)}</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </>
              ) : (
                <>
                  <span>{t('annotation.readDetail', language)}</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </>
              )}
            </button>

            {/* Next */}
            <button
              onClick={goNext}
              disabled={!hasNext}
              className="w-10 h-10 rounded-full border border-[var(--primary-dim)] flex items-center justify-center text-secondary hover:text-primary hover:border-primary/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

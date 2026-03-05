import React from 'react';
import { Language } from '../types';

interface LanguageSelectorProps {
  onSelect: (lang: Language) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onSelect }) => {
  return (
    <div className="absolute inset-0 z-50 bg-[var(--bg)] flex flex-col px-6 py-12 pt-safe pb-safe">

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        {/* Title — staggered reveal */}
        <div className="mb-14 opacity-0 animate-reveal">
          <h1 className="font-serif text-6xl text-shimmer mb-3 tracking-tight leading-none">
            ArtLens
          </h1>
          <p className="text-secondary text-sm font-medium tracking-[0.2em] uppercase opacity-0 animate-reveal-delay-1">
            AI Museum Companion
          </p>
        </div>

        {/* Subtitle */}
        <p className="text-secondary/70 text-sm mb-8 opacity-0 animate-reveal-delay-1">
          Point your camera at any artwork
        </p>

        {/* Language Options — staggered */}
        <div className="space-y-3 opacity-0 animate-reveal-delay-2">
          <LanguageOption label="English" subtitle="EN" onClick={() => onSelect('en')} />
          <LanguageOption label="Português" subtitle="PT" onClick={() => onSelect('pt')} />
          <LanguageOption label="Español" subtitle="ES" onClick={() => onSelect('es')} />
        </div>
      </div>

      {/* Footer */}
      <div className="text-center opacity-0 animate-reveal-delay-3">
        <p className="text-secondary/30 text-xs font-mono tracking-wider">v1.0</p>
      </div>
    </div>
  );
};

const LanguageOption = ({ label, subtitle, onClick }: { label: string; subtitle: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full py-5 px-6 rounded-2xl bg-[var(--surface)] border border-[var(--primary-dim)] text-left text-lg font-medium text-[var(--text)] hover:border-primary/40 active:scale-[0.98] transition-all duration-300 flex justify-between items-center group"
  >
    <div className="flex items-center gap-4">
      <span className="font-mono text-xs text-secondary/50 w-6">{subtitle}</span>
      <span className="font-sans">{label}</span>
    </div>
    <span className="text-secondary/30 group-hover:text-primary transition-colors duration-300">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
      </svg>
    </span>
  </button>
);

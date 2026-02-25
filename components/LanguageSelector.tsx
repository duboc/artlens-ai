import React from 'react';
import { Language } from '../types';

interface LanguageSelectorProps {
  onSelect: (lang: Language) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onSelect }) => {
  return (
    <div className="absolute inset-0 z-50 bg-[#121212] flex flex-col px-6 py-12 animate-fade-in">
      
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <div className="mb-12">
           <h1 className="text-5xl font-light text-white mb-2 tracking-tight">ArtLens</h1>
           <p className="text-primary text-sm font-medium tracking-widest uppercase">AI Museum Curator</p>
        </div>

        <div className="space-y-4">
           <LanguageOption label="English" onClick={() => onSelect('en')} />
           <LanguageOption label="Português" onClick={() => onSelect('pt')} />
           <LanguageOption label="Español" onClick={() => onSelect('es')} />
        </div>
      </div>

      <div className="text-center">
        <p className="text-zinc-600 text-xs">Powered by Gemini Flash 2.5</p>
      </div>
    </div>
  );
};

const LanguageOption = ({ label, onClick }: { label: string, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="w-full py-5 px-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-left text-lg font-medium text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700 active:scale-[0.98] transition-all flex justify-between items-center group"
  >
    <span>{label}</span>
    <span className="text-zinc-600 group-hover:text-primary transition-colors">→</span>
  </button>
);
import React, { useState } from 'react';
import { Language, UserContext, Persona } from '../types';

interface OnboardingFormProps {
  language: Language;
  onComplete: (context: UserContext) => void;
}

export const OnboardingForm: React.FC<OnboardingFormProps> = ({ language, onComplete }) => {
  const [name, setName] = useState('');
  const [selectedPersona, setSelectedPersona] = useState<Persona>('guide');

  const texts = {
    en: {
      askName: "What's your name?",
      askPersona: "Choose your experience",
      guide: "Guide",
      guideDesc: "Friendly & accessible",
      academic: "Curator",
      academicDesc: "Deep & scholarly",
      blogger: "Blogger",
      bloggerDesc: "Fun & trendy",
      continue: "Start Exploring"
    },
    pt: {
      askName: "Qual seu nome?",
      askPersona: "Escolha sua experiência",
      guide: "Guia",
      guideDesc: "Amigável e acessível",
      academic: "Curador",
      academicDesc: "Profundo e acadêmico",
      blogger: "Blogger",
      bloggerDesc: "Divertido e moderno",
      continue: "Começar"
    },
    es: {
      askName: "¿Cómo te llamas?",
      askPersona: "Elige tu experiencia",
      guide: "Guía",
      guideDesc: "Amigable y accesible",
      academic: "Curador",
      academicDesc: "Profundo y académico",
      blogger: "Blogger",
      bloggerDesc: "Divertido y moderno",
      continue: "Empezar"
    }
  };

  const t = texts[language];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onComplete({ name: name.trim(), persona: selectedPersona });
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-[#121212] flex flex-col px-6 py-8 animate-slide-up overflow-y-auto no-scrollbar">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col justify-center">
        
        <form onSubmit={handleSubmit} className="space-y-10">
          
          {/* Name Section */}
          <div className="space-y-4">
            <label className="text-white text-2xl font-light">{t.askName}</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent border-b-2 border-zinc-700 py-3 text-3xl text-primary font-medium placeholder-zinc-700 focus:outline-none focus:border-primary transition-colors"
              placeholder="Name"
              autoFocus
              required
            />
          </div>

          {/* Persona Section */}
          <div className="space-y-4">
             <label className="text-zinc-400 text-sm font-medium uppercase tracking-wider">{t.askPersona}</label>
             <div className="grid grid-cols-1 gap-3">
               <PersonaCard 
                  id="guide" 
                  title={t.guide} 
                  desc={t.guideDesc} 
                  icon="👋"
                  selected={selectedPersona === 'guide'} 
                  onSelect={() => setSelectedPersona('guide')} 
               />
               <PersonaCard 
                  id="academic" 
                  title={t.academic} 
                  desc={t.academicDesc} 
                  icon="🏛️"
                  selected={selectedPersona === 'academic'} 
                  onSelect={() => setSelectedPersona('academic')} 
               />
               <PersonaCard 
                  id="blogger" 
                  title={t.blogger} 
                  desc={t.bloggerDesc} 
                  icon="✨"
                  selected={selectedPersona === 'blogger'} 
                  onSelect={() => setSelectedPersona('blogger')} 
               />
             </div>
          </div>

          <div className="pt-4">
            <button 
                type="submit"
                disabled={!name.trim()}
                className="w-full py-5 rounded-full bg-white text-black font-bold text-lg hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl active:scale-95"
            >
                {t.continue}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PersonaCard = ({ id, title, desc, icon, selected, onSelect }: any) => (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-full p-4 rounded-2xl text-left border-2 transition-all duration-200 flex items-center gap-4
        ${selected 
          ? 'bg-primary/10 border-primary' 
          : 'bg-zinc-900 border-transparent hover:bg-zinc-800'
        }`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${selected ? 'bg-primary text-onPrimary' : 'bg-zinc-800 text-zinc-400'}`}>
        {icon}
      </div>
      <div>
        <h3 className={`font-semibold ${selected ? 'text-primary' : 'text-zinc-200'}`}>{title}</h3>
        <p className="text-sm text-zinc-500">{desc}</p>
      </div>
      {selected && (
         <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
         </div>
      )}
    </button>
);
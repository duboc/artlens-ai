import React from 'react';
import { Language, Persona, UserContext } from '../../types';
import { t, tf } from '../../utils/i18n';
import { ArrowRightIcon } from './icons';
import { PanelShell } from './MissionsPanel';

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'pt', label: 'Português' },
];

const PERSONAS: { id: Persona; label: string }[] = [
  { id: 'guide', label: 'result.guide' },
  { id: 'academic', label: 'result.curator' },
  { id: 'blogger', label: 'result.blogger' },
];

interface ProfilePanelProps {
  language: Language;
  userContext: UserContext;
  points: number | null;
  historyCount: number;
  onLanguageChange: (language: Language) => void;
  onPersonaChange: (persona: Persona) => void;
  onOpenHistory: () => void;
  onOpenGallery: () => void;
  onLogout: () => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({
  language, userContext, points, historyCount,
  onLanguageChange, onPersonaChange, onOpenHistory, onOpenGallery, onLogout,
}) => (
  <PanelShell>
    <header className="pt-12 pb-6">
      <h1 className="font-serif text-3xl text-[var(--text)] tracking-tight truncate">{userContext.name}</h1>
      <p className="text-secondary mt-2 truncate">{userContext.email}</p>
      {points !== null && (
        <p className="text-[var(--text)] mt-1 tabular">{tf('points.label', language, { points })}</p>
      )}
    </header>

    <div className="border-t border-white/[0.08]">
      <Row label={t('me.history', language)} value={String(historyCount)} onClick={onOpenHistory} />
      <Row label={t('me.gallery', language)} onClick={onOpenGallery} />
    </div>

    <Segmented
      title={t('settings.language', language)}
      options={LANGUAGES.map((l) => ({ id: l.id, label: l.label }))}
      value={language}
      onChange={(id) => onLanguageChange(id as Language)}
    />

    <Segmented
      title={t('me.guide', language)}
      options={PERSONAS.map((p) => ({ id: p.id, label: t(p.label, language) }))}
      value={userContext.persona}
      onChange={(id) => onPersonaChange(id as Persona)}
    />

    <button
      type="button"
      onClick={onLogout}
      className="mt-10 w-full min-h-[48px] text-left text-sm text-error border-y border-white/[0.08] hover:bg-error/10 transition-colors"
    >
      {t('settings.logout', language)}
    </button>
  </PanelShell>
);

const Row: React.FC<{ label: string; value?: string; onClick: () => void }> = ({ label, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full min-h-[56px] flex items-center justify-between gap-4 border-b border-white/[0.08] text-left text-base text-[var(--text)] hover:bg-white/[0.03] transition-colors"
  >
    <span>{label}</span>
    <span className="flex items-center gap-2 text-secondary">
      {value && <span className="font-mono tabular text-sm">{value}</span>}
      <ArrowRightIcon className="w-5 h-5" />
    </span>
  </button>
);

const Segmented: React.FC<{
  title: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}> = ({ title, options, value, onChange }) => (
  <fieldset className="mt-10">
    <legend className="text-sm text-secondary mb-3">{title}</legend>
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            className={`min-h-[44px] px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-200
              ${selected
                ? 'bg-primary/15 text-primary border border-primary/40'
                : 'bg-[var(--surface)] text-secondary border border-white/[0.08] hover:text-[var(--text)]'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  </fieldset>
);

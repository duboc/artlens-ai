import React from 'react';
import { Language } from '../../types';
import { t } from '../../utils/i18n';
import { ScanIcon, FlagIcon, PodiumIcon, PersonIcon } from './icons';

export type Tab = 'scan' | 'missions' | 'ranking' | 'me';

/** Height of the bar above the safe area, used to inset content above it. */
export const BOTTOM_NAV_HEIGHT = 64;

const TABS: { id: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'scan', label: 'nav.scan', Icon: ScanIcon },
  { id: 'missions', label: 'nav.missions', Icon: FlagIcon },
  { id: 'ranking', label: 'nav.ranking', Icon: PodiumIcon },
  { id: 'me', label: 'nav.me', Icon: PersonIcon },
];

interface BottomNavProps {
  active: Tab;
  language: Language;
  onChange: (tab: Tab) => void;
  /** Open missions count, shown as a small number on the Missions tab. */
  openMissions?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ active, language, onChange, openMissions }) => (
  <nav
    aria-label="Main"
    className="absolute inset-x-0 bottom-0 z-40 bg-[var(--surface)] border-t border-white/[0.08] pb-safe"
  >
    <ul className="grid grid-cols-4 max-w-lg mx-auto" style={{ height: BOTTOM_NAV_HEIGHT }}>
      {TABS.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <li key={id} className="flex">
            <button
              type="button"
              onClick={() => onChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-200
                ${isActive ? 'text-primary' : 'text-secondary'}`}
            >
              <span className="relative">
                <Icon className="w-6 h-6" />
                {id === 'missions' && !!openMissions && (
                  <span className="absolute -top-1.5 -right-3 min-w-[20px] h-5 px-1 rounded-full bg-primary-dark text-onPrimary text-xs font-mono leading-5 text-center tabular">
                    {openMissions}
                  </span>
                )}
              </span>
              {t(label, language)}
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);

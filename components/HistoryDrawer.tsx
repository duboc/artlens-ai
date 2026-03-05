import React from 'react';
import { HistoryItem, Language } from '../types';
import { t } from '../utils/i18n';

interface HistoryDrawerProps {
  isOpen: boolean;
  history: HistoryItem[];
  language: Language;
  onSelect: (item: HistoryItem) => void;
  onClose: () => void;
  onClear: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ isOpen, history, language, onSelect, onClose, onClear }) => {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-[var(--bg)]/70 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`absolute top-0 left-0 h-dvh w-80 max-w-[85vw] bg-[var(--bg)] border-r border-[var(--primary-dim)] z-50 transform transition-transform duration-300 shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 pt-safe-top mt-2 border-b border-[var(--primary-dim)] flex justify-between items-center">
          <h2 className="font-serif text-[var(--text)] text-lg pl-2">{t('history.title', language)}</h2>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs font-mono text-error/60 hover:text-error px-2 py-1 rounded transition-colors duration-300"
              >
                {t('history.clearAll', language)}
              </button>
            )}
            <button onClick={onClose} className="p-2 text-secondary hover:text-[var(--text)] bg-[var(--surface)] rounded-full transition-colors duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto h-full pb-32 no-scrollbar">
          {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                  <div className="w-14 h-14 rounded-full border border-[var(--primary-dim)] flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-secondary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="font-serif text-secondary/50 text-sm">{t('history.noScans', language)}</p>
                  <p className="text-secondary/30 text-xs mt-1">{t('history.noScansDesc', language)}</p>
              </div>
          ) : (
              history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className="p-4 border-b border-[var(--primary-dim)] hover:bg-primary/5 active:bg-primary/10 cursor-pointer flex gap-4 transition-colors duration-300 items-center"
                  >
                      <img src={item.imageUrl} alt={item.data.title} className="w-14 h-14 object-cover rounded-lg border border-[var(--primary-dim)] bg-[var(--surface)]" />
                      <div className="flex-1 overflow-hidden">
                          <div className="font-serif text-[var(--text)] text-sm truncate">{item.data.title}</div>
                          <div className="text-primary/60 text-xs truncate mb-1">{item.data.artist}</div>
                          <div className="text-secondary/30 text-[10px] font-mono">
                              {new Date(item.timestamp).toLocaleDateString()} · {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                      </div>
                      <div className="text-secondary/20">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
                      </div>
                  </div>
              ))
          )}
        </div>
      </div>
    </>
  );
};

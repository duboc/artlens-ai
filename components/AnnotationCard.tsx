import React, { useState, useEffect } from 'react';
import { Annotation } from '../types';

interface AnnotationCardProps {
  annotation: Annotation;
  onClose: () => void;
}

export const AnnotationCard: React.FC<AnnotationCardProps> = ({ annotation, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-expand and ensure text animates when switching between annotations
  useEffect(() => {
    setIsExpanded(true);
  }, [annotation.id]);

  return (
    <div className="w-full pointer-events-auto transition-all duration-300 ease-out animate-slide-up z-50">
      {/* Backdrop (Only when expanded to focus attention) */}
      {isExpanded && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10" onClick={() => setIsExpanded(false)} />
      )}

      {/* Card Container */}
      <div 
        className={`bg-[#1e1e1e]/95 backdrop-blur-xl border-t border-x border-white/10 rounded-t-[2rem] shadow-2xl relative overflow-hidden transition-all duration-300
          ${isExpanded ? 'pb-8' : 'pb-6'}
        `}
      >
        {/* Decorative Top Gradient */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-50" />
        
        {/* Drag Handle Area (Toggle Area) */}
        <div 
            className="w-full flex flex-col items-center pt-3 pb-2 cursor-pointer active:opacity-70"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="w-12 h-1.5 bg-zinc-600/50 rounded-full mb-2" />
        </div>

        <div className="px-6">
          {/* Header Row */}
          <div className="flex justify-between items-start gap-4 mb-3">
              <div 
                className="flex-1 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <h3 className="text-white font-bold text-lg leading-tight">{annotation.label}</h3>
                <p className="text-primary text-xs font-medium uppercase tracking-wider mt-1">Detail View</p>
              </div>
              
              <button 
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  className="p-2 -mr-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
              >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
          </div>
          
          {/* Content Area */}
          <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-64 opacity-100 mb-6' : 'max-h-0 opacity-0'}`}>
             <p 
                key={annotation.id}
                className="text-zinc-300 text-sm leading-relaxed font-light animate-slide-up"
             >
                {annotation.description}
             </p>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
             <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full py-3 rounded-xl text-sm font-medium border border-zinc-700 transition-colors flex items-center justify-center gap-2
                    ${isExpanded ? 'bg-zinc-800 text-zinc-300' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}
                `}
             >
                 {isExpanded ? (
                    <>
                        <span>Show Less</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </>
                 ) : (
                    <>
                        <span>Read Detail</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </>
                 )}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

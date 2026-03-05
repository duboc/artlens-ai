import React from 'react';
import { Annotation } from '../types';

interface ImageAnnotationLayerProps {
  annotations: Annotation[];
  activeId: string | null;
  onSelect: (annotation: Annotation) => void;
}

export const ImageAnnotationLayer: React.FC<ImageAnnotationLayerProps> = ({
  annotations,
  activeId,
  onSelect
}) => {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-10">
      {annotations.map((ann, index) => {
        const ymin = ann.box_2d[0];
        const xmin = ann.box_2d[1];
        const ymax = ann.box_2d[2];
        const xmax = ann.box_2d[3];

        const centerY = (ymin + ymax) / 2 / 10;
        const centerX = (xmin + xmax) / 2 / 10;

        const isActive = activeId === ann.id;

        // Truncate label to ~3-4 words
        const shortLabel = ann.label.split(' ').slice(0, 4).join(' ');

        return (
          <button
            key={ann.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(ann);
            }}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto group outline-none flex flex-col items-center gap-1"
            style={{
                top: `${centerY}%`,
                left: `${centerX}%`
            }}
            aria-label={`Select ${ann.label}`}
          >
            {/* Pulsing Outer Ring — 56px touch target meets Apple HIG 44px min */}
            <div className="relative w-14 h-14 flex items-center justify-center min-h-auto">
              <div className={`absolute inset-0 rounded-full border transition-all duration-300
                  ${isActive
                      ? 'border-primary/80 animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]'
                      : 'border-transparent'
                  }
              `} />

              {/* Numbered Dot — gold */}
              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 font-mono text-xs font-bold
                  ${isActive
                      ? 'bg-primary border-primary text-onPrimary scale-110 shadow-[0_0_20px_rgba(66,133,244,0.4)]'
                      : 'bg-primary/20 border-primary/60 text-primary backdrop-blur-sm group-hover:bg-primary/40'
                  }
              `}>
                {index + 1}
              </div>
            </div>

            {/* Always-visible compact label */}
            <div className={`min-h-auto px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap max-w-[100px] truncate transition-all duration-300
                ${isActive
                    ? 'bg-primary text-onPrimary'
                    : 'bg-[var(--bg)]/70 backdrop-blur-sm text-[var(--text)]/80 border border-primary/10'
                }
            `}>
              {shortLabel}
            </div>
          </button>
        );
      })}
    </div>
  );
};

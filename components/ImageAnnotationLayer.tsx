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
      {annotations.map((ann) => {
        // Convert 1000 scale to percentage
        // Box is [ymin, xmin, ymax, xmax]
        const ymin = ann.box_2d[0];
        const xmin = ann.box_2d[1];
        const ymax = ann.box_2d[2];
        const xmax = ann.box_2d[3];
        
        // Calculate Center Point for the dot
        const centerY = (ymin + ymax) / 2 / 10; // Result is %
        const centerX = (xmin + xmax) / 2 / 10; // Result is %

        const isActive = activeId === ann.id;

        return (
          <button
            key={ann.id}
            onClick={(e) => {
              e.stopPropagation(); // Prevent closing overlay when clicking dot
              onSelect(ann);
            }}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto group outline-none w-14 h-14 flex items-center justify-center" // Increased touch target to w-14 h-14 (56px)
            style={{ 
                top: `${centerY}%`, 
                left: `${centerX}%` 
            }}
            aria-label={`Select ${ann.label}`}
          >
            {/* Pulsing Outer Ring */}
            <div className={`absolute rounded-full border border-white/60 w-full h-full transition-all duration-300
                ${isActive 
                    ? 'opacity-100 border-primary animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]' 
                    : 'opacity-0 group-hover:opacity-100 animate-pulse-slow'
                }
            `}></div>
            
            {/* Inner Ring */}
            <div className={`w-6 h-6 rounded-full border-2 shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-all duration-300 backdrop-blur-sm flex items-center justify-center
                ${isActive 
                    ? 'bg-primary border-white scale-110' 
                    : 'bg-white/20 border-white/80 group-hover:bg-white/40'
                }
            `}>
                {/* Center Dot */}
                <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-white'}`}></div>
            </div>

            {/* Label Tooltip (Only visible if no active selection to reduce clutter) */}
            {!activeId && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none border border-white/10">
                    {ann.label}
                </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

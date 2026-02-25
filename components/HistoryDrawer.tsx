import React from 'react';
import { HistoryItem } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClose: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ isOpen, history, onSelect, onClose }) => {
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={`absolute top-0 left-0 h-[100dvh] w-80 max-w-[85vw] bg-[#121212] border-r border-white/10 z-50 transform transition-transform duration-300 shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 pt-safe-top mt-2 border-b border-white/10 flex justify-between items-center">
           <h2 className="text-white font-bold tracking-widest text-sm pl-2">HISTORY</h2>
           <button onClick={onClose} className="p-2 text-white/50 hover:text-white bg-white/5 rounded-full">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>
        
        <div className="overflow-y-auto h-full pb-32 custom-scrollbar">
           {history.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                   <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 text-white/20">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                   </div>
                   <p className="text-white/40 text-sm">No scans yet.</p>
                   <p className="text-white/20 text-xs mt-1">Identified artworks will appear here.</p>
               </div>
           ) : (
               history.map((item) => (
                   <div 
                     key={item.id}
                     onClick={() => onSelect(item)}
                     className="p-4 border-b border-white/5 hover:bg-white/5 active:bg-white/10 cursor-pointer flex gap-4 transition-colors items-center"
                   >
                       <img src={item.imageUrl} alt={item.data.title} className="w-16 h-16 object-cover rounded-lg border border-white/10 bg-white/5" />
                       <div className="flex-1 overflow-hidden">
                           <div className="text-white text-base font-medium truncate">{item.data.title}</div>
                           <div className="text-primary text-xs truncate mb-1">{item.data.artist}</div>
                           <div className="text-white/30 text-[10px]">
                               {new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </div>
                       </div>
                       <div className="text-white/20">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
                       </div>
                   </div>
               ))
           )}
        </div>
      </div>
    </>
  );
};
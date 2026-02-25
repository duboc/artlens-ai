import React, { useRef } from 'react';

interface HUDOverlayProps {
  isScanning: boolean;
  onScan: () => void;
  onUpload: (file: File) => void;
  hasResult: boolean;
  onHistoryClick: () => void;
  children: React.ReactNode;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({ 
  isScanning, 
  onScan, 
  onUpload,
  hasResult, 
  onHistoryClick,
  children 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
    // Reset input value so same file can be selected again if needed
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between overflow-hidden h-[100dvh]">
      
      {/* Top Status Bar */}
      <div className="w-full pt-safe-top mt-4 px-6 flex items-start justify-between z-20 pointer-events-auto">
         
         {/* History Button */}
         {!hasResult && (
           <button 
             onClick={onHistoryClick}
             className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-colors shadow-lg"
             aria-label="History"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
           </button>
         )}

         {/* App Badge */}
         <div className={`bg-black/40 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full flex items-center gap-2 transition-opacity duration-300 ${hasResult ? 'opacity-0' : 'opacity-100'}`}>
            <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-primary animate-pulse' : 'bg-white/80'}`}></div>
            <span className="text-xs font-medium text-white/90 tracking-wide">ArtLens</span>
         </div>
         
         {/* Spacer to balance the flex layout */}
         <div className="w-10"></div>
      </div>

      {/* Main Viewfinder Area */}
      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${hasResult ? 'opacity-0' : 'opacity-100'}`}>
        {/* Minimal Reticle */}
        {!isScanning && (
          <div className="relative w-64 h-64 opacity-80 transition-all duration-500">
             {/* Corners */}
             <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white/50 rounded-tl-lg"></div>
             <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white/50 rounded-tr-lg"></div>
             <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white/50 rounded-bl-lg"></div>
             <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white/50 rounded-br-lg"></div>
             
             {/* Center Point */}
             <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-white/80 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
          </div>
        )}

        {/* Scanning State */}
        {isScanning && (
           <div className="relative w-48 h-48 flex items-center justify-center">
              <div className="absolute inset-0 border-2 border-primary/50 rounded-3xl animate-pulse"></div>
              <div className="w-16 h-1 bg-primary/80 blur-sm animate-pulse rounded-full"></div>
           </div>
        )}
      </div>

      {/* Bottom Interface Layer */}
      <div className="relative w-full h-full z-30 pointer-events-none">
        
        {/* Result Card Container - Floats naturally via flex or absolute positioning in children */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end p-4 pb-safe-bottom">
            {children}
        </div>

        {/* Shutter & Upload Buttons */}
        {!hasResult && (
           <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center pb-safe-bottom pointer-events-auto transition-all duration-300 transform">
             
             {/* Upload Input */}
             <input 
                type="file" 
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
             />

             {/* Shutter Button */}
             <button
               onClick={onScan}
               disabled={isScanning}
               className={`relative flex items-center justify-center rounded-full transition-all duration-300 shadow-2xl z-10
                 ${isScanning 
                   ? 'w-16 h-16 bg-white/10 scale-95 cursor-wait' 
                   : 'w-20 h-20 bg-transparent hover:scale-105 active:scale-95'
                 }`}
             >
               {/* Outer Ring */}
               <div className="absolute inset-0 rounded-full border-[4px] border-white"></div>
               
               {/* Inner Circle */}
               <div className={`rounded-full transition-all duration-300 ${isScanning ? 'w-8 h-8 bg-primary rounded-md' : 'w-16 h-16 bg-white'}`}></div>
             </button>

             {/* Upload Button - Positioned to the right */}
             <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className={`absolute right-8 sm:right-16 p-3.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-all active:scale-95 shadow-lg
                    ${isScanning ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                `}
                aria-label="Upload Image"
             >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
             </button>

             <p className="absolute -bottom-8 text-center text-xs font-medium text-white/70 tracking-wide opacity-80 shadow-black drop-shadow-md w-full">
               {isScanning ? 'Analyzing...' : 'Tap to identify'}
             </p>
           </div>
        )}
      </div>
    </div>
  );
};

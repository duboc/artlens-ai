import React, { useState, useRef, useCallback } from 'react';
import { CameraFeed } from './components/CameraFeed';
import { HUDOverlay } from './components/HUDOverlay';
import { AnalysisResultCard } from './components/AnalysisResultCard';
import { HistoryDrawer } from './components/HistoryDrawer';
import { LanguageSelector } from './components/LanguageSelector';
import { OnboardingForm } from './components/OnboardingForm';
import { ImageAnnotationLayer } from './components/ImageAnnotationLayer';
import { AnnotationCard } from './components/AnnotationCard';
import { ChatWindow } from './components/ChatWindow'; // Ensure we can open chat with context
import { identifyArtwork, getDeepArtworkAnalysis } from './services/geminiService';
import { IdentifyResponse, HistoryItem, Language, UserContext, Annotation } from './types';

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language | null>(null);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);
  const [result, setResult] = useState<IdentifyResponse | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Annotation State
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
  
  // Chat State integration
  const [forceChatOpen, setForceChatOpen] = useState(false);
  const [initialChatQuery, setInitialChatQuery] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Function to capture the current frame
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video stream
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Return full Data URL for preview
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  const addToHistory = (image: string, data: IdentifyResponse) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      imageUrl: image,
      data: data
    };
    setHistory(prev => [newItem, ...prev]);
  };

  const executeDeepAnalysis = async (rawBase64: string, initialResult: IdentifyResponse, lang: Language) => {
    setIsDeepAnalyzing(true);
    try {
        const deepData = await getDeepArtworkAnalysis(rawBase64, initialResult, lang);
        
        const updatedResult = { ...initialResult, deepAnalysis: deepData };
        setResult(updatedResult); // This triggers the UI update with new data

        // Update history item with deep analysis
        setHistory(prev => prev.map(item => {
            if (item.data.title === initialResult.title && item.timestamp === prev[0]?.timestamp) {
                return { ...item, data: updatedResult };
            }
            return item;
        }));
    } catch (err) {
        console.error("Background Deep Analysis failed", err);
        // We don't block the UI for this, just log it.
    } finally {
        setIsDeepAnalyzing(false);
    }
  };

  const processImageAnalysis = async (imageDataUrl: string) => {
    if (isAnalyzing || !language) return;

    setError(null);
    setIsAnalyzing(true);
    setResult(null); 
    setActiveAnnotation(null);
    setCurrentImage(imageDataUrl);

    try {
      // Send raw base64 (without prefix) to API
      const rawBase64 = imageDataUrl.split(',')[1];
      const response = await identifyArtwork(rawBase64, language);
      
      setResult(response);
      addToHistory(imageDataUrl, response);
      
      // Trigger Async Deep Analysis immediately
      executeDeepAnalysis(rawBase64, response, language);

    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || "Failed to identify artwork. Please try again.");
      setCurrentImage(null); // Unfreeze/Clear on error
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleScan = async () => {
    try {
      const fullDataUrl = captureFrame();
      if (!fullDataUrl) {
        throw new Error("Failed to capture camera frame.");
      }
      await processImageAnalysis(fullDataUrl);
    } catch (err: any) {
        setError(err.message);
    }
  };

  const handleUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const fullDataUrl = e.target?.result as string;
        if (fullDataUrl) {
            await processImageAnalysis(fullDataUrl);
        } else {
            setError("Failed to process image file.");
        }
    };
    reader.onerror = () => setError("Error reading file.");
    reader.readAsDataURL(file);
  };

  // Manual deep scan is technically no longer needed as primary action, 
  // but kept as internal logic reference if needed. 
  // We removed the manual trigger from UI in AnalysisResultCard.

  const handleReset = () => {
    setResult(null);
    setError(null);
    setCurrentImage(null);
    setActiveAnnotation(null);
    setForceChatOpen(false);
    setIsDeepAnalyzing(false);
  };

  const handleSelectHistory = (item: HistoryItem) => {
      setCurrentImage(item.imageUrl);
      setResult(item.data);
      setIsHistoryOpen(false);
      setActiveAnnotation(null);
  };
  
  // 1. Language Selection
  if (!language) {
      return <LanguageSelector onSelect={setLanguage} />;
  }

  // 2. Onboarding (Name/Persona)
  if (!userContext) {
      return <OnboardingForm language={language} onComplete={setUserContext} />;
  }

  // 3. Main AR App
  return (
    <div className="relative w-full h-[100dvh] bg-black overflow-hidden font-mono">
      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Live Camera Layer - Supports freeze frame */}
      <CameraFeed videoRef={videoRef} frozenImage={currentImage} />
      
      {/* AR Annotation Layer - Only visible when we have a result and image is frozen */}
      {result && result.annotations && currentImage && !forceChatOpen && (
          <ImageAnnotationLayer 
            annotations={result.annotations} 
            activeId={activeAnnotation?.id || null}
            onSelect={setActiveAnnotation}
          />
      )}

      {/* History Drawer */}
      <HistoryDrawer 
        isOpen={isHistoryOpen} 
        history={history} 
        onSelect={handleSelectHistory}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* HUD Layer - Handles Overlay UI elements */}
      <HUDOverlay 
        isScanning={isAnalyzing} 
        onScan={handleScan}
        onUpload={handleUpload}
        hasResult={!!result}
        onHistoryClick={() => setIsHistoryOpen(true)}
      >
        {/* Error Notification */}
        {error && (
          <div className="absolute top-24 left-4 right-4 bg-red-900/80 border border-red-500 text-white p-4 rounded-xl backdrop-blur-md z-50 pointer-events-auto shadow-2xl animate-fade-in">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-red-200 text-sm mb-1">SYSTEM ERROR</p>
                <p className="text-sm text-white">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="text-white/50 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Widget for Annotation */}
        {/* If an annotation is active, it takes priority in the bottom slot */}
        {activeAnnotation ? (
            <AnnotationCard 
                annotation={activeAnnotation} 
                onClose={() => setActiveAnnotation(null)}
            />
        ) : (
            /* Main Result Display - Only shown if no specific annotation is selected */
            result && (
              <AnalysisResultCard 
                data={result} 
                language={language}
                userContext={userContext}
                onClose={handleReset} 
                isDeepAnalyzing={isDeepAnalyzing}
                forcedChatOpen={forceChatOpen}
                initialChatQuery={initialChatQuery}
                onChatClose={() => {
                    setForceChatOpen(false);
                    setInitialChatQuery(null);
                }}
              />
            )
        )}
      </HUDOverlay>
    </div>
  );
};

export default App;

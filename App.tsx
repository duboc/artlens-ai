import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CameraFeed } from './components/CameraFeed';
import { HUDOverlay } from './components/HUDOverlay';
import { AnalysisResultCard } from './components/AnalysisResultCard';
import { HistoryDrawer } from './components/HistoryDrawer';
import { LanguageSelector } from './components/LanguageSelector';
import { OnboardingForm } from './components/OnboardingForm';
import { ImageAnnotationLayer } from './components/ImageAnnotationLayer';
import { AnnotationCard } from './components/AnnotationCard';
import { ChatWindow } from './components/ChatWindow';
import { GenerateModal } from './components/GenerateModal';
import { Gallery } from './components/Gallery';
import { identifyArtwork, getDeepArtworkAnalysis } from './services/geminiService';
import { getUserId, setUserId, apiPost, apiPatch, recoverSession } from './services/apiClient';
import { IdentifyResponse, HistoryItem, Language, UserContext, Annotation, Persona, GeneratedImage } from './types';
import { t } from './utils/i18n';

const STORAGE_KEYS = {
  language: 'artlens_language',
  userContext: 'artlens_userContext',
};

function historyKey(email: string): string {
  return `artlens_history_${email.toLowerCase()}`;
}

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.language);
    return saved ? (saved as Language) : null;
  });
  const [userContext, setUserContext] = useState<UserContext | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.userContext);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    // Require email — force re-onboarding for legacy data without it
    if (!parsed.email) return null;
    return parsed;
  });

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

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

  // History State — scoped per user email
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const ctx = localStorage.getItem(STORAGE_KEYS.userContext);
    if (!ctx) return [];
    try {
      const parsed = JSON.parse(ctx);
      if (!parsed.email) return [];
      const saved = localStorage.getItem(historyKey(parsed.email));
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Generate Me modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // Capture flash
  const [showFlash, setShowFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Persist language
  useEffect(() => {
    if (language) {
      localStorage.setItem(STORAGE_KEYS.language, language);
    }
  }, [language]);

  // Persist userContext
  useEffect(() => {
    if (userContext) {
      localStorage.setItem(STORAGE_KEYS.userContext, JSON.stringify(userContext));
    }
  }, [userContext]);

  // Persist history — scoped by user email
  useEffect(() => {
    if (userContext?.email) {
      localStorage.setItem(historyKey(userContext.email), JSON.stringify(history));
    }
  }, [history, userContext?.email]);

  // Recover session on startup — if we have userContext but no userId, look up by email
  useEffect(() => {
    if (userContext?.email && !getUserId()) {
      recoverSession();
    }
  }, []);

  // Reload history when user changes (e.g. after onboarding or switching accounts)
  useEffect(() => {
    if (userContext?.email) {
      const saved = localStorage.getItem(historyKey(userContext.email));
      setHistory(saved ? JSON.parse(saved) : []);
    }
  }, [userContext?.email]);

  // Back navigation handlers
  const handleBackToLanguage = () => {
    setLanguage(null);
    localStorage.removeItem(STORAGE_KEYS.language);
  };

  const handleLogout = () => {
    setUserContext(null);
    setResult(null);
    setCurrentImage(null);
    setShowSettingsMenu(false);
    localStorage.removeItem(STORAGE_KEYS.userContext);
    localStorage.removeItem('artlens_userId');
  };

  const handleSetUserContext = (ctx: UserContext) => {
    setUserContext(ctx);
  };

  const handlePersonaChange = (persona: Persona) => {
    if (!userContext) return;
    const updated = { ...userContext, persona };
    setUserContext(updated);
    // Persist to backend (non-blocking)
    const userId = getUserId();
    if (userId) {
      apiPatch(`/api/users/${userId}`, { persona }).catch(err => {
        console.error('Failed to update persona on backend:', err);
      });
    }
  };

  // Function to capture the current frame
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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

  const clearHistory = () => {
    setHistory([]);
    if (userContext?.email) {
      localStorage.removeItem(historyKey(userContext.email));
    }
  };

  const executeDeepAnalysis = async (rawBase64: string, initialResult: IdentifyResponse, lang: Language, scanId?: string) => {
    setIsDeepAnalyzing(true);
    try {
        const deepData = await getDeepArtworkAnalysis(rawBase64, initialResult, lang);

        const updatedResult = { ...initialResult, deepAnalysis: deepData };
        setResult(updatedResult);

        setHistory(prev => prev.map(item => {
            if (item.data.title === initialResult.title && item.timestamp === prev[0]?.timestamp) {
                return { ...item, data: updatedResult };
            }
            return item;
        }));

        // Persist deep analysis to backend
        if (scanId && getUserId()) {
          apiPatch(`/api/scans/${scanId}/deep-analysis`, { deepAnalysis: deepData }).catch(err => {
            console.error('Failed to persist deep analysis:', err);
          });
        }
    } catch (err) {
        console.error("Background Deep Analysis failed", err);
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
      const rawBase64 = imageDataUrl.split(',')[1];
      const response = await identifyArtwork(rawBase64, language);

      setResult(response);
      addToHistory(imageDataUrl, response);

      // Persist scan to backend (non-blocking)
      let scanId: string | undefined;
      if (getUserId()) {
        try {
          const scanResult = await apiPost<{ scanId: string }>('/api/scans', {
            artData: response,
            language,
          });
          scanId = scanResult.scanId;

          // Upload captured image (non-blocking)
          const blob = await fetch(imageDataUrl).then(r => r.blob());
          const formData = new FormData();
          formData.append('file', blob, 'scan.jpg');
          formData.append('type', 'scan');
          formData.append('scanId', scanId);
          fetch('/api/images/upload', {
            method: 'POST',
            headers: { 'X-User-Id': getUserId()! },
            body: formData,
          }).catch(err => console.error('Scan image upload failed:', err));
        } catch (err) {
          console.error('Failed to persist scan:', err);
        }
      }

      executeDeepAnalysis(rawBase64, response, language, scanId);

    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || "Failed to identify artwork. Please try again.");
      setCurrentImage(null);
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
      // Haptic feedback + flash effect
      if (navigator.vibrate) navigator.vibrate(50);
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 400);
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
      return (
        <OnboardingForm
          language={language}
          onComplete={handleSetUserContext}
          onBack={handleBackToLanguage}
        />
      );
  }

  // 3. Main AR App
  return (
    <div className="relative w-full h-dvh bg-[var(--bg)] overflow-hidden">
      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Capture flash overlay */}
      {showFlash && (
        <div className="absolute inset-0 bg-primary/30 z-50 pointer-events-none capture-flash" />
      )}

      {/* Live Camera Layer */}
      <CameraFeed videoRef={videoRef} frozenImage={currentImage} language={language} />

      {/* Artwork Title Overlay — visible on frozen frame */}
      {result && currentImage && (
        <div className="absolute top-0 left-0 right-0 z-5 pt-safe pointer-events-none">
          <div className="mt-20 px-6">
            <div className="warm-glass rounded-2xl px-4 py-3 inline-block max-w-[80%]">
              <h2 className="font-serif text-[var(--text)] text-base leading-tight">{result.title}</h2>
              <p className="text-secondary text-xs mt-0.5">{result.artist} · {result.year}</p>
            </div>
          </div>
        </div>
      )}

      {/* AR Annotation Layer */}
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
        language={language}
        onSelect={handleSelectHistory}
        onClose={() => setIsHistoryOpen(false)}
        onClear={clearHistory}
      />

      {/* HUD Layer */}
      <HUDOverlay
        isScanning={isAnalyzing}
        onScan={handleScan}
        onUpload={handleUpload}
        hasResult={!!result}
        language={language}
        onHistoryClick={() => setIsHistoryOpen(true)}
        historyCount={history.length}
        onSettingsClick={() => setShowSettingsMenu(!showSettingsMenu)}
        onGalleryClick={() => setIsGalleryOpen(true)}
      >
        {/* Error Notification */}
        {error && (
          <div className="absolute top-24 left-4 right-4 warm-glass border-error/30 text-white p-4 rounded-xl z-50 pointer-events-auto shadow-2xl animate-fade-in">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-mono text-error text-xs font-medium mb-1 uppercase tracking-wider">Error</p>
                <p className="text-sm text-[var(--text)]">{error}</p>
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
        {activeAnnotation ? (
            <AnnotationCard
                annotation={activeAnnotation}
                annotations={result?.annotations || []}
                language={language}
                onClose={() => setActiveAnnotation(null)}
                onNavigate={setActiveAnnotation}
            />
        ) : (
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
                onScanAnother={handleReset}
                onPersonaChange={handlePersonaChange}
                onGenerateMe={() => setShowGenerateModal(true)}
                hasSelfie={!!userContext.selfieUrl}
              />
            )
        )}
      </HUDOverlay>

      {/* Settings Menu */}
      {showSettingsMenu && userContext && language && (
        <div className="absolute inset-0 z-[60]" onClick={() => setShowSettingsMenu(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute top-20 right-4 w-64 bg-[var(--surface)] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-xs text-secondary/60 font-mono">{t('settings.loggedAs', language)}</p>
              <p className="text-sm text-[var(--text)] font-medium truncate mt-0.5">{userContext.name}</p>
              <p className="text-xs text-secondary/50 truncate">{userContext.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 text-left text-sm text-error/80 hover:bg-error/10 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t('settings.logout', language)}
            </button>
          </div>
        </div>
      )}

      {/* Gallery */}
      {language && (
        <Gallery
          isOpen={isGalleryOpen}
          language={language}
          onClose={() => setIsGalleryOpen(false)}
        />
      )}

      {/* Generate Me Modal */}
      {showGenerateModal && result && language && (
        <GenerateModal
          artData={result}
          language={language}
          onClose={() => setShowGenerateModal(false)}
          onSaved={() => setShowGenerateModal(false)}
        />
      )}
    </div>
  );
};

export default App;

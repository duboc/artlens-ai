import React, { useState, useRef, useCallback, useEffect, startTransition } from 'react';
import { flushSync } from 'react-dom';
import { CameraFeed } from './components/CameraFeed';
import { HUDOverlay } from './components/HUDOverlay';
import { ResultSheet } from './components/result/ResultSheet';
import type { SheetPage } from './components/result/ScanPage';
import { HistoryDrawer } from './components/HistoryDrawer';
import { LanguageSelector } from './components/LanguageSelector';
import { OnboardingForm } from './components/OnboardingForm';
import { ChatWindow } from './components/ChatWindow';
import { GenerateModal } from './components/GenerateModal';
import { Gallery } from './components/Gallery';
import { BottomNav, Tab, BOTTOM_NAV_HEIGHT } from './components/game/BottomNav';
import { MissionsPanel } from './components/game/MissionsPanel';
import { RankingPanel } from './components/game/RankingPanel';
import { ProfilePanel } from './components/game/ProfilePanel';
import { AwardToast } from './components/game/AwardToast';
import { fetchMissions, awardScan, MissionsState } from './services/gameApi';
import { getMuseum } from './museums';
import { identifyArtwork, getDeepArtworkAnalysis } from './services/geminiService';
import { unlockAudio, NarrationRecording } from './hooks/useNarration';
import type { PreviousStop } from './utils/narrationPrompt';
import { useNarrationActions } from './hooks/NarrationProvider';
import { encodeWav } from './utils/narrationTimeline';
import { createArtworkShareCard, shareOrDownload } from './utils/shareCard';
import { useWakeLock } from './hooks/useWakeLock';
import { getUserId, setUserId, apiPost, apiGet, apiPatch, recoverSession } from './services/apiClient';
import { IdentifyResponse, HistoryItem, Language, UserContext, Persona, ScanAwards } from './types';
import { t } from './utils/i18n';

const STORAGE_KEYS = {
  language: 'artlens_language',
  userContext: 'artlens_userContext',
};



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

  // Game layer: tabs, points, awards
  const [tab, setTab] = useState<Tab>('scan');
  const [points, setPoints] = useState<number | null>(null);
  const [openMissions, setOpenMissions] = useState<number | undefined>(undefined);
  const [gameRefreshKey, setGameRefreshKey] = useState(0);
  const [awards, setAwards] = useState<ScanAwards | null>(null);
  const [isImmersive, setIsImmersive] = useState(false);
  const wasImmersiveRef = useRef(false);
  /** Last artwork narrated in this session (history may lag a few seconds behind a new scan). */
  const lastStopRef = useRef<PreviousStop | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);
  const [result, setResult] = useState<IdentifyResponse | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  /** 'current' for a fresh scan, or the history id when a past scan was opened. */
  const [sheetKey, setSheetKey] = useState<string>('current');
  /** Page of the result sheet in view; the staged photo above the sheet follows it. */
  const [activePage, setActivePage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Chat State integration
  const [forceChatOpen, setForceChatOpen] = useState(false);
  const [initialChatQuery, setInitialChatQuery] = useState<string | null>(null);

  // History State — loaded from backend
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Generate Me modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // Narration (TTS)
  // Stable controls only: caption updates re-render the narration panel, not the app
  const narration = useNarrationActions();

  // Keep screen awake during museum use
  useWakeLock();

  // Screen locked / app switched: saved audio keeps playing with lock-screen controls,
  // the live stream pauses (resumable)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) narration.backgrounded();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [narration]);

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

  // Recover session on startup — if we have userContext but no userId, look up by email
  useEffect(() => {
    if (userContext?.email && !getUserId()) {
      recoverSession().then(() => loadHistory());
    }
  }, []);

  // Load history from backend when user changes
  const loadHistory = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return;
    try {
      const data = await apiGet<{ scans: HistoryItem[] }>(`/api/users/${userId}/scans`);
      startTransition(() => setHistory(data.scans || []));
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }, []);

  useEffect(() => {
    if (userContext?.email && getUserId()) {
      loadHistory();
    }
  }, [userContext?.email, loadHistory]);

  const applyMissionsState = useCallback((state: MissionsState) => {
    setPoints(state.points);
    setOpenMissions(state.missions.filter((m) => !m.completed).length);
  }, []);

  // Load points / open missions once the visitor is known
  useEffect(() => {
    if (userContext?.email && getUserId()) {
      fetchMissions().then(applyMissionsState).catch(() => { /* panel shows its own error */ });
    }
  }, [userContext?.email, gameRefreshKey, applyMissionsState]);

  /** Scan that earned the current notice: it only shows inside that scan's sheet. */
  const [awardsScanId, setAwardsScanId] = useState<string | null>(null);
  const dismissAwards = useCallback(() => setAwards(null), []);

  // Back navigation handlers
  const handleBackToLanguage = () => {
    setLanguage(null);
    localStorage.removeItem(STORAGE_KEYS.language);
  };

  const handleLogout = () => {
    setUserContext(null);
    setResult(null);
    setCurrentImage(null);
    setTab('scan');
    setPoints(null);
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

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    const userId = getUserId();
    if (userId) {
      apiPatch(`/api/users/${userId}`, { language: lang }).catch(err => {
        console.error('Failed to update language on backend:', err);
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

  const addToHistory = (scanId: string, data: IdentifyResponse) => {
    const userId = getUserId();
    const newItem: HistoryItem = {
      id: scanId,
      timestamp: Date.now(),
      imageUrl: userId ? `/api/images/users/${userId}/scans/${scanId}.jpg` : '',
      data: data
    };
    startTransition(() => setHistory(prev => [newItem, ...prev.filter((h) => h.id !== scanId)]));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const executeDeepAnalysis = async (
    rawBase64: string,
    initialResult: IdentifyResponse,
    lang: Language,
    scanIdPromise: Promise<string | undefined>,
  ) => {
    setIsDeepAnalyzing(true);
    try {
        const deepData = await getDeepArtworkAnalysis(rawBase64, initialResult, lang);
        const scanId = await scanIdPromise;

        const updatedResult = { ...initialResult, deepAnalysis: deepData };
        // Background data: an interruptible render that yields to a sheet drag in progress.
        // Only update the open result if it is still this scan (never reopen a closed sheet).
        startTransition(() => {
          setResult((prev) => (prev === initialResult ? updatedResult : prev));
          setHistory(prev => prev.map(item => {
              if (item.id === scanId) {
                  return { ...item, data: updatedResult };
              }
              return item;
          }));
        });

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

  /** Score a saved scan and show what was earned (never blocks the visitor). */
  const requestAwards = (scanId: string) => {
    awardScan(scanId)
      .then((earned) => startTransition(() => {
        setPoints(earned.totalPoints);
        if (earned.points > 0) {
          setAwards(earned);
          setAwardsScanId(scanId);
        }
        if (earned.missions.length) {
          setOpenMissions((n) => (n === undefined ? n : Math.max(0, n - earned.missions.length)));
        }
      }))
      .catch((err) => console.error('Failed to award scan:', err));
  };

  const uploadScanImage = async (imageDataUrl: string, scanId: string) => {
    try {
      const blob = await fetch(imageDataUrl).then(r => r.blob());
      const formData = new FormData();
      formData.append('file', blob, 'scan.jpg');
      formData.append('type', 'scan');
      formData.append('scanId', scanId);
      await fetch('/api/images/upload', {
        method: 'POST',
        headers: { 'X-User-Id': getUserId()! },
        body: formData,
      });
    } catch (err) {
      console.error('Scan image upload failed:', err);
    }
  };

  /** Save the intro narration (WAV + text + timings) with its scan, and keep a local copy for swiping. */
  const saveNarration = async (recording: NarrationRecording, scanId: string) => {
    try {
      const form = new FormData();
      form.append('audio', new Blob([encodeWav(recording.pcm)], { type: 'audio/wav' }), 'narration.wav');
      form.append('meta', JSON.stringify({
        script: recording.script,
        sentences: recording.sentences.map((s) => ({ ...s, start: Number.isFinite(s.start) ? s.start : 0 })),
        durationSec: recording.durationSec,
      }));
      const res = await fetch(`/api/scans/${scanId}/narration`, {
        method: 'POST',
        headers: { 'X-User-Id': getUserId()! },
        body: form,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { audioUrl } = await res.json();
      const narrationData = {
        audioUrl,
        script: recording.script,
        sentences: recording.sentences.map((s) => ({ ...s, start: Number.isFinite(s.start) ? s.start : 0 })),
        durationSec: recording.durationSec,
      };
      startTransition(() => setHistory((prev) => prev.map((h) => (h.id === scanId ? { ...h, data: { ...h.data, narration: narrationData } } : h))));
    } catch (err) {
      console.error('Failed to save narration:', err);
    }
  };

  /** Show a result, morphing the full-screen camera frame into the photo above the sheet where supported. */
  const presentResult = (response: IdentifyResponse) => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    // The sheet always rises with its spring; the view transition morphs the photo alongside it
    setActivePage(0);
    if (doc.startViewTransition && !reduceMotion) {
      doc.startViewTransition(() => {
        flushSync(() => setResult(response));
      });
    } else {
      setResult(response);
    }
  };

  /** The visitor's previous stop, so the guide greets only at the first artwork of a visit. */
  const previousStop = (): PreviousStop | null => {
    const fromHistory = history[0] ? { title: history[0].data.title, artist: history[0].data.artist, at: history[0].timestamp } : null;
    const fromSession = lastStopRef.current;
    if (!fromHistory) return fromSession;
    if (!fromSession) return fromHistory;
    return fromSession.at >= fromHistory.at ? fromSession : fromHistory;
  };

  const processImageAnalysis = async (imageDataUrl: string) => {
    if (isAnalyzing || !language) return;

    // Silence any narration at once; if it is still streaming, generate() hands it to a background
    // collector so the previous scan still gets its narration saved
    narration.detach();

    setError(null);
    setIsAnalyzing(true);
    setResult(null);
    setCurrentImage(imageDataUrl);
    setCurrentScanId(null);
    setSheetKey('current');

    try {
      const rawBase64 = imageDataUrl.split(',')[1];
      const response = await identifyArtwork(rawBase64, language);

      presentResult(response);

      // Save the scan; deep analysis, narration, upload and scoring all run in parallel
      const scanIdPromise: Promise<string | undefined> = getUserId()
        ? apiPost<{ scanId: string }>('/api/scans', { artData: response, language, museumId: getMuseum().id })
            .then((r) => r.scanId)
            .catch((err) => { console.error('Failed to persist scan:', err); return undefined; })
        : Promise.resolve(undefined);

      executeDeepAnalysis(rawBase64, response, language, scanIdPromise);

      // Narration with live captions (parallel, non-blocking); saved with the scan when done
      if (userContext) {
        const previous = previousStop();
        lastStopRef.current = { title: response.title, artist: response.artist, at: Date.now() };
        Promise.all([
          narration.generate(response, userContext.persona, language, userContext.name, previous),
          scanIdPromise,
        ]).then(([recording, id]) => {
          if (recording && id) saveNarration(recording, id);
        });
      }

      const scanId = await scanIdPromise;
      if (scanId) {
        startTransition(() => setCurrentScanId(scanId));
        requestAwards(scanId);
        await uploadScanImage(imageDataUrl, scanId);
        // Add to history only after the upload so the thumbnail URL resolves
        addToHistory(scanId, response);
      }

    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || "Failed to identify artwork. Please try again.");
      setCurrentImage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleScan = async () => {
    unlockAudio();
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

  /** Chat / quiz opened or closed inside the sheet; on close, refresh what was done with each scan. */
  const handleImmersiveChange = useCallback((immersive: boolean) => {
    setIsImmersive(immersive);
    if (wasImmersiveRef.current && !immersive) loadHistory();
    wasImmersiveRef.current = immersive;
  }, [loadHistory]);

  const handleReset = () => {
    setAwards(null); // the notice belongs to the scan that earned it
    setResult(null);
    setError(null);
    setCurrentImage(null);
    setCurrentScanId(null);
    setForceChatOpen(false);
    setIsDeepAnalyzing(false);
    // Go silent, but let the narration finish streaming so it is saved with the scan
    narration.detach();
  };

  const handleSelectHistory = (item: HistoryItem) => {
      setCurrentImage(item.imageUrl);
      setSheetKey(item.id);
      setAwards(null);
      setActivePage(0);
      setResult(item.data);
      setCurrentScanId(item.id);
      setIsHistoryOpen(false);
      setTab('scan');
  };

  const handleShare = async (page: SheetPage) => {
    if (!page.imageUrl) return;
    try {
      const blob = await createArtworkShareCard(page.imageUrl, page.data);
      await shareOrDownload(blob, `artlens-${page.data.title.replace(/[^a-zA-Z0-9]/g, '-')}.png`, page.data.title,
        `${page.data.title} by ${page.data.artist} (${page.data.year}) — AI Leadership Academy`);
    } catch { /* cancelled */ }
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
  const showNav = !result && !showGenerateModal;

  // Sheet pages: the open scan first, then earlier scans to swipe through
  const sheetPages: SheetPage[] = result ? [
    {
      key: sheetKey, data: result, imageUrl: currentImage, scanId: currentScanId,
      activity: history.find((h) => h.id === (currentScanId ?? sheetKey))?.activity,
    },
    ...history
      .filter((h) => h.id !== currentScanId && h.id !== sheetKey)
      .map((h) => ({ key: h.id, data: h.data, imageUrl: h.imageUrl, scanId: h.id, activity: h.activity })),
  ] : [];

  return (
    <div className="relative w-full h-dvh bg-[var(--bg)] overflow-hidden">
      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Capture flash overlay */}
      {showFlash && (
        <div className="absolute inset-0 bg-primary/30 z-50 pointer-events-none capture-flash" />
      )}

      {/* Live Camera Layer */}
      <CameraFeed
        videoRef={videoRef}
        frozenImage={result ? sheetPages[activePage]?.imageUrl ?? currentImage : currentImage}
        language={language}
        transitionName="scan-photo"
        staged={!!result}
      />

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
        lastCapture={history[0] ? { imageUrl: history[0].imageUrl, title: history[0].data.title, count: history.length } : null}
        onOpenCaptures={() => history[0] && handleSelectHistory(history[0])}
        hasResult={!!result}
        language={language}
        points={points}
        onPointsClick={() => setTab('missions')}
        bottomInset={showNav ? BOTTOM_NAV_HEIGHT : 0}
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

      </HUDOverlay>

      {/* Result: gesture-driven sheet (medium / full), swipe sideways through earlier scans */}
      {result && (
        <ResultSheet
          key={`${sheetKey}-${currentImage?.length ?? 0}`}
          pages={sheetPages}
          language={language}
          userContext={userContext}
          isDeepAnalyzing={isDeepAnalyzing}
          hasSelfie={!!userContext.selfieUrl}
          animateIn
          onActiveChange={setActivePage}
          toast={awards && awardsScanId === currentScanId && sheetKey === 'current' ? (
            <AwardToast
              inline
              awards={awards}
              language={language}
              onDismiss={dismissAwards}
              onViewMissions={() => { setAwards(null); handleReset(); setTab('missions'); }}
            />
          ) : null}
          onClosed={handleReset}
          onImmersiveChange={handleImmersiveChange}
          onPointsChange={setPoints}
          onPersonaChange={handlePersonaChange}
          onGenerateMe={() => setShowGenerateModal(true)}
          onShare={handleShare}
        />
      )}

      {/* Game panels (camera keeps running underneath) */}
      {tab === 'missions' && (
        <MissionsPanel
          language={language}
          refreshKey={gameRefreshKey}
          onLoaded={applyMissionsState}
          onGoScan={() => setTab('scan')}
        />
      )}
      {tab === 'ranking' && <RankingPanel language={language} refreshKey={gameRefreshKey} />}
      {tab === 'me' && (
        <ProfilePanel
          language={language}
          userContext={userContext}
          points={points}
          historyCount={history.length}
          onLanguageChange={handleLanguageChange}
          onPersonaChange={handlePersonaChange}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenGallery={() => setIsGalleryOpen(true)}
          onLogout={handleLogout}
        />
      )}

      {showNav && (
        <BottomNav
          active={tab}
          language={language}
          openMissions={openMissions}
          onChange={(next) => {
            setTab(next);
            if (next !== 'scan') setGameRefreshKey((k) => k + 1);
          }}
        />
      )}

      {awards && !result && (
        <AwardToast
          awards={awards}
          language={language}
          onDismiss={dismissAwards}
          onViewMissions={() => { setAwards(null); setTab('missions'); }}
        />
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

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Language, UserContext, Persona } from '../types';
import { t } from '../utils/i18n';
import { apiPost, setUserId } from '../services/apiClient';

interface OnboardingFormProps {
  language: Language;
  onComplete: (context: UserContext) => void;
  onBack: () => void;
}

interface FoundUser {
  userId: string;
  name: string;
  persona: Persona;
  selfieUrl: string;
}

type Step = 'email' | 'welcome-back' | 'name' | 'selfie' | 'persona';

const STEP_ORDER: Step[] = ['email', 'name', 'selfie', 'persona'];

function stepNumber(step: Step): number {
  if (step === 'welcome-back') return 1;
  const idx = STEP_ORDER.indexOf(step);
  return idx >= 0 ? idx + 1 : 1;
}

export const OnboardingForm: React.FC<OnboardingFormProps> = ({ language, onComplete, onBack }) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [selectedPersona, setSelectedPersona] = useState<Persona>('guide');
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);

  // Selfie camera refs
  const selfieVideoRef = useRef<HTMLVideoElement>(null);
  const selfieCanvasRef = useRef<HTMLCanvasElement>(null);
  const selfieStreamRef = useRef<MediaStream | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const startSelfieCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      selfieStreamRef.current = stream;
      if (selfieVideoRef.current) {
        selfieVideoRef.current.srcObject = stream;
        selfieVideoRef.current.play().catch(() => {});
        setIsCameraReady(true);
      }
    } catch (err) {
      console.error('Selfie camera error:', err);
    }
  }, []);

  const stopSelfieCamera = useCallback(() => {
    if (selfieStreamRef.current) {
      selfieStreamRef.current.getTracks().forEach(track => track.stop());
      selfieStreamRef.current = null;
    }
    setIsCameraReady(false);
  }, []);

  // Start/stop camera when entering/leaving selfie step
  useEffect(() => {
    if (step === 'selfie' && !selfieDataUrl) {
      startSelfieCamera();
    }
    return () => {
      if (step !== 'selfie') stopSelfieCamera();
    };
  }, [step, selfieDataUrl, startSelfieCamera, stopSelfieCamera]);

  const captureSelfie = () => {
    if (!selfieVideoRef.current || !selfieCanvasRef.current) return;
    const video = selfieVideoRef.current;
    const canvas = selfieCanvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    setSelfieDataUrl(canvas.toDataURL('image/jpeg', 0.8));
    stopSelfieCamera();
  };

  const retakeSelfie = () => {
    setSelfieDataUrl(null);
    startSelfieCamera();
  };

  // Step 1: Email lookup
  const handleEmailNext = async () => {
    if (!email.trim()) return;
    setIsLookingUp(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      if (data.found) {
        setFoundUser(data);
        setName(data.name);
        setSelectedPersona(data.persona || 'guide');
        setStep('welcome-back');
      } else {
        setFoundUser(null);
        setStep('name');
      }
    } catch {
      // Lookup failed — proceed as new user
      setFoundUser(null);
      setStep('name');
    } finally {
      setIsLookingUp(false);
    }
  };

  // Returning user: continue with existing profile
  const handleContinueAsReturning = async () => {
    if (!foundUser) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Upsert to get the userId and update lastActiveAt
      const { userId } = await apiPost<{ userId: string }>('/api/users', {
        name: foundUser.name,
        email: email.trim(),
        persona: foundUser.persona,
        language,
      });
      setUserId(userId);
      onComplete({
        name: foundUser.name,
        email: email.trim(),
        persona: foundUser.persona,
        selfieUrl: foundUser.selfieUrl || undefined,
      });
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to sign in');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Returning user: not them, start fresh
  const handleNotYou = () => {
    setFoundUser(null);
    setEmail('');
    setName('');
    setStep('email');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { userId } = await apiPost<{ userId: string }>('/api/users', {
        name: name.trim(),
        email: email.trim(),
        persona: selectedPersona,
        language,
      });
      setUserId(userId);

      if (selfieDataUrl) {
        try {
          const blob = await fetch(selfieDataUrl).then(r => r.blob());
          const formData = new FormData();
          formData.append('file', blob, 'selfie.jpg');
          formData.append('type', 'selfie');
          await fetch('/api/images/upload', {
            method: 'POST',
            headers: { 'X-User-Id': userId },
            body: formData,
          });
        } catch (e) {
          console.error('Selfie upload failed (non-blocking):', e);
        }
      }

      onComplete({ name: name.trim(), email: email.trim(), persona: selectedPersona, selfieUrl: selfieDataUrl ? `users/${userId}/selfie.jpg` : undefined });
    } catch (err: any) {
      console.error('Onboarding submit error:', err);
      setSubmitError(err.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 'email') {
      onBack();
    } else if (step === 'welcome-back') {
      setStep('email');
    } else if (step === 'name') {
      setStep('email');
    } else if (step === 'selfie') {
      stopSelfieCamera();
      setStep('name');
    } else if (step === 'persona') {
      setStep('selfie');
    }
  };

  const totalSteps = 4;
  const currentStep = stepNumber(step);

  return (
    <div className="absolute inset-0 z-50 bg-[var(--bg)] flex flex-col px-6 pt-safe overflow-y-auto no-scrollbar pb-safe">
      <canvas ref={selfieCanvasRef} className="hidden" />

      {/* Back button + Step indicator */}
      <div className="flex items-center justify-between opacity-0 animate-reveal">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-secondary hover:text-primary transition-colors py-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm">{t('onboarding.back', language)}</span>
        </button>
        <span className="text-xs font-mono text-secondary/50">
          {currentStep} {t('onboarding.stepOf', language)} {totalSteps}
        </span>
      </div>

      {/* Step Progress Bar */}
      <div className="flex gap-2 mt-2 mb-6">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              i < currentStep ? 'bg-primary' : 'bg-[var(--primary-dim)]'
            }`}
          />
        ))}
      </div>

      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col justify-center">

        {/* Step: Email */}
        {step === 'email' && (
          <div className="space-y-10 opacity-0 animate-reveal" key="email">
            <div className="space-y-4">
              <label className="font-serif text-3xl text-[var(--text)]">
                {t('onboarding.askEmail', language)}
              </label>
              <input
                type="email"
                inputMode="email"
                enterKeyHint="next"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleEmailNext(); }}
                className="w-full bg-transparent border-b-2 border-[var(--primary-dim)] py-3 text-2xl text-primary font-medium placeholder-secondary/30 focus:outline-none focus:border-primary transition-colors duration-300"
                placeholder={t('onboarding.emailPlaceholder', language)}
                autoFocus
              />
            </div>

            <div className="pt-4 opacity-0 animate-reveal-delay-1">
              <button
                onClick={handleEmailNext}
                disabled={!email.trim() || isLookingUp}
                className="w-full py-4 rounded-full bg-primary text-onPrimary font-semibold text-base hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isLookingUp && (
                  <div className="w-4 h-4 border-2 border-onPrimary/30 border-t-onPrimary rounded-full animate-spin" />
                )}
                {t('onboarding.next', language)}
              </button>
            </div>
          </div>
        )}

        {/* Step: Welcome Back (returning user) */}
        {step === 'welcome-back' && foundUser && (
          <div className="space-y-8 opacity-0 animate-reveal" key="welcome-back">
            <div className="flex flex-col items-center text-center space-y-4">
              {foundUser.selfieUrl && (
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/30 bg-[var(--surface)]">
                  <img src={`/api/images/${foundUser.selfieUrl}`} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <p className="text-secondary text-sm">{t('onboarding.welcomeBack', language)}</p>
                <h2 className="font-serif text-3xl text-[var(--text)] mt-1">{foundUser.name}</h2>
                <p className="text-secondary/60 text-sm mt-1 font-mono">{email}</p>
              </div>
            </div>

            <div className="space-y-3">
              {submitError && (
                <p className="text-error text-xs text-center mb-2">{submitError}</p>
              )}
              <button
                onClick={handleContinueAsReturning}
                disabled={isSubmitting}
                className="w-full py-4 rounded-full bg-primary text-onPrimary font-semibold text-base hover:brightness-110 disabled:opacity-50 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isSubmitting && (
                  <div className="w-4 h-4 border-2 border-onPrimary/30 border-t-onPrimary rounded-full animate-spin" />
                )}
                {t('onboarding.continueAs', language)}
              </button>
              <button
                onClick={handleNotYou}
                className="w-full py-3 text-sm text-secondary hover:text-primary transition-colors duration-300"
              >
                {t('onboarding.notYou', language)}
              </button>
            </div>
          </div>
        )}

        {/* Step: Name (new user) */}
        {step === 'name' && (
          <div className="space-y-10 opacity-0 animate-reveal" key="name">
            <div className="space-y-4">
              <label className="font-serif text-3xl text-[var(--text)]">
                {t('onboarding.askName', language)}
              </label>
              <input
                type="text"
                inputMode="text"
                enterKeyHint="next"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setStep('selfie'); }}
                className="w-full bg-transparent border-b-2 border-[var(--primary-dim)] py-3 text-2xl text-primary font-medium placeholder-secondary/30 focus:outline-none focus:border-primary transition-colors duration-300"
                placeholder={t('onboarding.namePlaceholder', language)}
                autoFocus
              />
            </div>

            <div className="pt-4 opacity-0 animate-reveal-delay-1">
              <button
                onClick={() => setStep('selfie')}
                disabled={!name.trim()}
                className="w-full py-4 rounded-full bg-primary text-onPrimary font-semibold text-base hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 active:scale-[0.98]"
              >
                {t('onboarding.next', language)}
              </button>
            </div>
          </div>
        )}

        {/* Step: Selfie Capture */}
        {step === 'selfie' && (
          <div className="flex flex-col items-center gap-6 opacity-0 animate-reveal" key="selfie">
            <div className="text-center">
              <h2 className="font-serif text-2xl text-[var(--text)] mb-2">
                {t('onboarding.selfieTitle', language)}
              </h2>
              <p className="text-sm text-secondary/70">
                {t('onboarding.selfieDesc', language)}
              </p>
            </div>

            <div className="relative w-48 h-48 rounded-full overflow-hidden border-2 border-[var(--primary-dim)] bg-[var(--surface)]">
              {selfieDataUrl ? (
                <img src={selfieDataUrl} alt="Selfie" className="w-full h-full object-cover" />
              ) : (
                <video
                  ref={selfieVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              )}
              {!selfieDataUrl && !isCameraReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 w-full">
              {selfieDataUrl ? (
                <>
                  <button
                    onClick={() => setStep('persona')}
                    className="w-full py-4 rounded-full bg-primary text-onPrimary font-semibold text-base hover:brightness-110 transition-all duration-300 active:scale-[0.98]"
                  >
                    {t('onboarding.next', language)}
                  </button>
                  <button
                    onClick={retakeSelfie}
                    className="w-full py-3 text-sm text-secondary hover:text-primary transition-colors duration-300"
                  >
                    {t('onboarding.retake', language)}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={captureSelfie}
                    disabled={!isCameraReady}
                    className="w-full py-4 rounded-full bg-primary text-onPrimary font-semibold text-base hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 active:scale-[0.98]"
                  >
                    {t('onboarding.capture', language)}
                  </button>
                  <button
                    onClick={() => setStep('persona')}
                    className="w-full py-3 text-sm text-secondary hover:text-primary transition-colors duration-300"
                  >
                    {t('onboarding.skipSelfie', language)}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step: Persona Selection */}
        {step === 'persona' && (
          <div className="space-y-10 opacity-0 animate-reveal" key="persona">
            <div className="space-y-4">
              <label className="text-secondary text-xs font-mono uppercase tracking-[0.2em]">
                {t('onboarding.askPersona', language)}
              </label>
              <div className="grid grid-cols-1 gap-3">
                <PersonaCard
                  title={t('onboarding.guide', language)}
                  desc={t('onboarding.guideDesc', language)}
                  quote={t('onboarding.guideQuote', language)}
                  selected={selectedPersona === 'guide'}
                  onSelect={() => setSelectedPersona('guide')}
                />
                <PersonaCard
                  title={t('onboarding.academic', language)}
                  desc={t('onboarding.academicDesc', language)}
                  quote={t('onboarding.academicQuote', language)}
                  selected={selectedPersona === 'academic'}
                  onSelect={() => setSelectedPersona('academic')}
                />
                <PersonaCard
                  title={t('onboarding.blogger', language)}
                  desc={t('onboarding.bloggerDesc', language)}
                  quote={t('onboarding.bloggerQuote', language)}
                  selected={selectedPersona === 'blogger'}
                  onSelect={() => setSelectedPersona('blogger')}
                />
              </div>
            </div>

            <div className="pt-4 space-y-3">
              {submitError && (
                <p className="text-error text-xs text-center mb-2">{submitError}</p>
              )}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-4 rounded-full bg-primary text-onPrimary font-semibold text-base hover:brightness-110 disabled:opacity-50 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isSubmitting && (
                  <div className="w-4 h-4 border-2 border-onPrimary/30 border-t-onPrimary rounded-full animate-spin" />
                )}
                {t('onboarding.continue', language)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PersonaCard = ({ title, desc, quote, selected, onSelect }: {
  title: string;
  desc: string;
  quote: string;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`relative w-full p-4 rounded-2xl text-left border transition-all duration-300
      ${selected
        ? 'bg-primary/5 border-primary/40'
        : 'bg-[var(--surface)] border-[var(--primary-dim)] hover:border-primary/20'
      }`}
  >
    <div className="flex items-start justify-between mb-2">
      <div>
        <h3 className={`font-serif text-lg ${selected ? 'text-primary' : 'text-[var(--text)]'}`}>{title}</h3>
        <p className="text-xs text-secondary">{desc}</p>
      </div>
      {selected && (
        <div className="text-primary mt-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
    <p className={`text-xs italic leading-relaxed ${selected ? 'text-primary/60' : 'text-secondary/40'}`}>
      {quote}
    </p>
  </button>
);

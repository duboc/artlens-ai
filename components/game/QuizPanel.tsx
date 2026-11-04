import React, { useEffect, useState } from 'react';
import { Language } from '../../types';
import { t, tf } from '../../utils/i18n';
import { startQuiz, answerQuiz, QuizState, QuizAnswerResult } from '../../services/gameApi';
import { CheckIcon, CrossIcon, ArrowRightIcon } from './icons';

interface QuizPanelProps {
  scanId: string;
  language: Language;
  onClose: () => void;
  onPointsChange?: (totalPoints: number) => void;
}

type Revealed = QuizAnswerResult & { choice: number };

export const QuizPanel: React.FC<QuizPanelProps> = ({ scanId, language, onClose, onPointsChange }) => {
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [earned, setEarned] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [finished, setFinished] = useState(false);

  const load = () => {
    setError(null);
    startQuiz(scanId, language)
      .then((q) => {
        setQuiz(q);
        // Resume where the visitor left off
        const answered = Object.keys(q.answers).map(Number);
        const correct = Object.values(q.answers).filter((a) => a.correct).length;
        setCorrectCount(correct);
        if (answered.length >= q.questions.length) {
          setFinished(true);
        } else {
          setIndex(q.questions.findIndex((_, i) => q.answers[i] === undefined));
        }
      })
      .catch((err) => setError(err.message || t('common.error', language)));
  };

  useEffect(load, [scanId]);

  const choose = async (choice: number) => {
    if (!quiz || revealed || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await answerQuiz(scanId, index, choice);
      setRevealed({ ...result, choice });
      setEarned((e) => e + result.pointsAwarded + result.bonus);
      if (result.correct) setCorrectCount((c) => c + 1);
      if (result.bonus) setBonus(result.bonus);
      onPointsChange?.(result.totalPoints);
      if (navigator.vibrate) navigator.vibrate(result.correct ? 30 : [20, 40, 20]);
    } catch (err: any) {
      setError(err.message || t('common.error', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const next = () => {
    if (!quiz) return;
    if (revealed?.finished || index + 1 >= quiz.questions.length) {
      setFinished(true);
    } else {
      setIndex(index + 1);
    }
    setRevealed(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/[0.08]">
        <p className="text-sm text-secondary tabular" aria-live="polite">
          {quiz && !finished ? tf('quiz.progress', language, { n: index + 1, total: quiz.questions.length }) : t('quiz.cta', language)}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close', language)}
          className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-secondary hover:text-[var(--text)]"
        >
          <CrossIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 py-6">
        {error && (
          <div role="alert" className="flex items-center justify-between gap-4 py-3 border-y border-error/30">
            <p className="text-sm text-[var(--text)]/90">{error}</p>
            <button type="button" onClick={load} className="text-sm font-medium text-primary px-3 min-h-[44px]">
              {t('common.retry', language)}
            </button>
          </div>
        )}

        {!quiz && !error && (
          <div className="py-16 flex flex-col items-center gap-4 text-secondary">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm">{t('quiz.loading', language)}</p>
          </div>
        )}

        {quiz && finished && (
          <div className="py-8 animate-fade-in">
            <p className="font-serif text-3xl text-[var(--text)] tracking-tight tabular">
              {tf('quiz.result', language, { correct: correctCount, total: quiz.questions.length, points: earned })}
            </p>
            {bonus > 0 && <p className="text-sm text-primary mt-3">{t('quiz.perfect', language)}</p>}
            <button
              type="button"
              onClick={onClose}
              className="mt-10 w-full min-h-[48px] rounded-full bg-primary-dark text-onPrimary font-medium text-sm active:scale-[0.98] transition-transform"
            >
              {t('quiz.back', language)}
            </button>
          </div>
        )}

        {quiz && !finished && (
          <div key={index} className="animate-fade-in">
            <h3 className="font-serif text-xl text-[var(--text)] leading-snug tracking-tight">
              {quiz.questions[index].question}
            </h3>

            <ul className="mt-6 space-y-2.5">
              {quiz.questions[index].options.map((option, i) => {
                const isChosen = revealed?.choice === i;
                const isAnswer = revealed?.correctIndex === i;
                const state = !revealed ? 'idle' : isAnswer ? 'right' : isChosen ? 'wrong' : 'dim';
                return (
                  <li key={i}>
                    <button
                      type="button"
                      disabled={!!revealed || isSubmitting}
                      onClick={() => choose(i)}
                      className={`w-full min-h-[52px] px-4 py-3 rounded-xl border text-left text-base flex items-center justify-between gap-3 transition-colors duration-200
                        ${state === 'idle' ? 'border-white/[0.12] text-[var(--text)] hover:border-primary/50 active:bg-primary/10' : ''}
                        ${state === 'right' ? 'border-success/60 bg-success/15 text-[var(--text)]' : ''}
                        ${state === 'wrong' ? 'border-error/60 bg-error/15 text-[var(--text)]' : ''}
                        ${state === 'dim' ? 'border-white/[0.06] text-secondary' : ''}`}
                    >
                      <span>{option}</span>
                      {state === 'right' && <CheckIcon className="w-5 h-5 text-success shrink-0" />}
                      {state === 'wrong' && <CrossIcon className="w-5 h-5 text-error shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>

            {revealed && (
              <div className="mt-6 animate-fade-in" aria-live="polite">
                <p className={`text-base font-medium ${revealed.correct ? 'text-success' : 'text-[var(--text)]'}`}>
                  {revealed.correct ? t('quiz.correct', language) : t('quiz.wrong', language)}
                  {revealed.pointsAwarded > 0 && <span className="font-mono tabular ml-2">+{revealed.pointsAwarded} {t('points.unit', language)}</span>}
                </p>
                <p className="text-sm text-[var(--text)]/80 leading-relaxed mt-2 max-w-[60ch]">{revealed.explanation}</p>
                <button
                  type="button"
                  onClick={next}
                  className="mt-6 w-full min-h-[48px] rounded-full bg-primary-dark text-onPrimary font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  {revealed.finished || index + 1 >= quiz.questions.length ? t('quiz.finish', language) : t('quiz.next', language)}
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

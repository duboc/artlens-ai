import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { HUDOverlay } from '../components/HUDOverlay';
import { BottomNav } from '../components/game/BottomNav';
import { ProfilePanel } from '../components/game/ProfilePanel';
import { AiTracePanel } from '../components/game/AiTracePanel';
import { setMuseum, DEFAULT_MUSEUM_ID } from '../museums';
import type { AiTrace } from '../types';

vi.mock('../services/gameApi', () => ({
  fetchMissions: vi.fn(),
  fetchLeaderboard: vi.fn(),
  startQuiz: vi.fn(),
  answerQuiz: vi.fn(),
}));
import * as gameApi from '../services/gameApi';
import { MissionsPanel } from '../components/game/MissionsPanel';
import { RankingPanel } from '../components/game/RankingPanel';
import { QuizPanel } from '../components/game/QuizPanel';

const hudProps = {
  isScanning: false,
  onScan: vi.fn(),
  onUpload: vi.fn(),
  hasResult: false,
  language: 'en' as const,
  onPointsClick: vi.fn(),
  children: null,
};

describe('HUD points pill', () => {
  it('shows the points and opens missions on tap', () => {
    const onPointsClick = vi.fn();
    render(<HUDOverlay {...hudProps} points={240} onPointsClick={onPointsClick} />);
    const pill = screen.getByRole('button', { name: /240 pts/ });
    fireEvent.click(pill);
    expect(onPointsClick).toHaveBeenCalled();
  });

  it('hides the pill while points are unknown, and has no settings/history/gallery buttons', () => {
    render(<HUDOverlay {...hudProps} points={null} />);
    expect(screen.queryByRole('button', { name: /pts/ })).toBeNull();
    expect(screen.queryByLabelText('Settings')).toBeNull();
    expect(screen.queryByLabelText('History')).toBeNull();
    expect(screen.queryByLabelText('Gallery')).toBeNull();
  });
});

describe('BottomNav', () => {
  it('renders four tabs, marks the active one and reports changes', () => {
    const onChange = vi.fn();
    render(<BottomNav active="missions" language="es" onChange={onChange} openMissions={5} />);
    const tabs = screen.getAllByRole('button');
    expect(tabs.map((b) => b.textContent)).toEqual(['Escanear', '5Misiones', 'Ranking', 'Perfil']);
    expect(screen.getByRole('button', { name: /Misiones/ })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Ranking' }));
    expect(onChange).toHaveBeenCalledWith('ranking');
  });
});

describe('ProfilePanel', () => {
  it('opens history and gallery, switches language and persona', () => {
    const props = {
      language: 'en' as const,
      userContext: { name: 'Ana García', email: 'ana@example.com', persona: 'guide' as const },
      points: 130,
      historyCount: 4,
      onLanguageChange: vi.fn(),
      onPersonaChange: vi.fn(),
      onOpenHistory: vi.fn(),
      onOpenGallery: vi.fn(),
      onLogout: vi.fn(),
    };
    render(<ProfilePanel {...props} />);
    expect(screen.getByText('130 points')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Scanned artworks/ }));
    fireEvent.click(screen.getByRole('button', { name: /My portraits/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Español' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Historian' }));
    expect(props.onOpenHistory).toHaveBeenCalled();
    expect(props.onOpenGallery).toHaveBeenCalled();
    expect(props.onLanguageChange).toHaveBeenCalledWith('es');
    expect(props.onPersonaChange).toHaveBeenCalledWith('academic');
  });
});

describe('AiTracePanel', () => {
  const trace: AiTrace = {
    model: 'gemini-3.5-flash-lite',
    fallbackUsed: false,
    latencyMs: 3120,
    thinkingLevel: 'LOW',
    confidence: 'high',
    evidence: 'The bull, the horse and the light bulb match Guernica.',
    searchQueries: ['Guernica Picasso Reina Sofía'],
    museumContext: 'Museo Reina Sofía',
  };
  const sources = [{ title: 'Guernica — Museo Reina Sofía', uri: 'https://www.museoreinasofia.es/coleccion/obra/guernica' }];

  it('is collapsed by default and reveals the trace on tap', () => {
    render(<AiTracePanel trace={trace} sources={sources} language="en" />);
    const toggle = screen.getByRole('button', { name: /How the AI thought/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('gemini-3.5-flash-lite')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('gemini-3.5-flash-lite')).toBeTruthy();
    // The DOM uses a narrow no-break space before "s"; the default matcher normalizes it
    expect(screen.getAllByText('3.1 s').length).toBeGreaterThan(0);
    expect(screen.getByText('High')).toBeTruthy();
    expect(screen.getByText('Guernica Picasso Reina Sofía')).toBeTruthy();
    expect(screen.getByText('Museum profile: Museo Reina Sofía')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Guernica — Museo Reina Sofía/ })).toHaveAttribute('href', sources[0].uri);
  });

  it('explains when there was no search and when no trace was recorded', () => {
    const { unmount } = render(<AiTracePanel trace={{ ...trace, searchQueries: [] }} sources={[]} language="en" defaultOpen />);
    expect(screen.getByText(/No search this time/)).toBeTruthy();
    unmount();
    render(<AiTracePanel sources={[]} language="en" defaultOpen />);
    expect(screen.getByText('Not recorded for this scan.')).toBeTruthy();
  });
});

describe('MissionsPanel', () => {
  beforeEach(() => setMuseum('reina-sofia'));

  it('summarizes progress and shows what completed each mission', async () => {
    vi.mocked(gameApi.fetchMissions).mockResolvedValue({
      museumId: 'reina-sofia',
      points: 260,
      missions: [
        { id: 'guernica', points: 150, completed: true, completedWith: 'Guernica' },
        { id: 'bull', points: 100, completed: true, completedWith: 'Guernica' },
      ],
    });
    render(<MissionsPanel language="en" refreshKey={0} onGoScan={vi.fn()} />);
    await screen.findByText('2 of 8 completed · 260 points');
    expect(screen.getByText('The scream of Guernica')).toBeTruthy();
    expect(screen.getAllByText('Guernica').length).toBe(2);
    expect(screen.getAllByRole('img', { name: 'Completed' }).length).toBe(2);
    expect(screen.getAllByRole('img', { name: 'Not completed yet' }).length).toBe(6);
    setMuseum(DEFAULT_MUSEUM_ID);
  });
});

describe('RankingPanel', () => {
  it('shows your position and highlights your row', async () => {
    vi.mocked(gameApi.fetchLeaderboard).mockResolvedValue({
      museumId: 'reina-sofia',
      entries: [
        { rank: 1, name: 'Luis P.', points: 400, missions: 3, isYou: false },
        { rank: 2, name: 'Ana G.', points: 260, missions: 2, isYou: true },
      ],
      you: { rank: 2, points: 260, missions: 2 },
      totalPlayers: 12,
    });
    render(<RankingPanel language="es" refreshKey={0} />);
    await screen.findByText('Estás en el puesto 2 de 12');
    const yourRow = screen.getByText('Ana G.').closest('li')!;
    expect(yourRow).toHaveAttribute('aria-current', 'true');
  });
});

describe('QuizPanel', () => {
  it('reveals the right answer, awards points and shows the result', async () => {
    vi.mocked(gameApi.startQuiz).mockResolvedValue({
      questions: [{ question: 'Who painted Guernica?', options: ['Dalí', 'Picasso', 'Miró', 'Gris'] }],
      answers: {},
      pointsPerQuestion: 20,
      perfectBonus: 20,
    });
    vi.mocked(gameApi.answerQuiz).mockResolvedValue({
      correct: true, correctIndex: 1, explanation: 'Picasso painted it in 1937.',
      pointsAwarded: 20, bonus: 20, totalPoints: 300, finished: true,
    });
    const onPointsChange = vi.fn();
    render(<QuizPanel scanId="scan-1" language="en" onClose={vi.fn()} onPointsChange={onPointsChange} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Picasso' }));
    await screen.findByText('Picasso painted it in 1937.');
    expect(gameApi.answerQuiz).toHaveBeenCalledWith('scan-1', 0, 1);
    expect(onPointsChange).toHaveBeenCalledWith(300);
    expect(screen.getByRole('button', { name: 'Dalí' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /See result/ }));
    await waitFor(() => expect(screen.getByText('1 of 1 correct · +40 pts')).toBeTruthy());
    expect(screen.getByText('Includes the perfect-score bonus.')).toBeTruthy();
  });
});

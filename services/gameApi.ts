import { apiGet, apiPost } from './apiClient';
import { getMuseum } from '../museums';
import { Language, ScanAwards } from '../types';

export interface MissionStatus {
  id: string;
  points: number;
  completed: boolean;
  /** Title of the artwork that completed the mission. */
  completedWith: string | null;
}

export interface MissionsState {
  museumId: string;
  points: number;
  missions: MissionStatus[];
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  missions: number;
  isYou: boolean;
}

export interface Leaderboard {
  museumId: string;
  entries: LeaderboardEntry[];
  you: { rank: number; points: number; missions: number } | null;
  totalPlayers: number;
}

export interface QuizState {
  questions: { question: string; options: string[] }[];
  answers: Record<string, { choice: number; correct: boolean }>;
  pointsPerQuestion: number;
  perfectBonus: number;
}

export interface QuizAnswerResult {
  correct: boolean;
  correctIndex: number;
  explanation: string;
  pointsAwarded: number;
  bonus: number;
  totalPoints: number;
  finished: boolean;
}

const museumQuery = () => `museum=${encodeURIComponent(getMuseum().id)}`;

export const awardScan = (scanId: string) =>
  apiPost<ScanAwards>(`/api/game/scans/${encodeURIComponent(scanId)}/award?${museumQuery()}`, {});

export const fetchMissions = () => apiGet<MissionsState>(`/api/game/missions?${museumQuery()}`);

export const fetchLeaderboard = () => apiGet<Leaderboard>(`/api/game/leaderboard?${museumQuery()}`);

export const startQuiz = (scanId: string, language: Language) =>
  apiPost<QuizState>(`/api/game/quiz/${encodeURIComponent(scanId)}?${museumQuery()}`, { language });

export const answerQuiz = (scanId: string, questionIndex: number, choice: number) =>
  apiPost<QuizAnswerResult>(`/api/game/quiz/${encodeURIComponent(scanId)}/answer?${museumQuery()}`, { questionIndex, choice });

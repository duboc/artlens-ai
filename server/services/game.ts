import { Firestore, FieldValue } from '@google-cloud/firestore';
import { generateText, extractText } from './vertexai';
import { log } from '../utils/logger';
import type { Mission, MuseumProfile } from '../../museums';
import { POINTS, QUIZ_LENGTH } from '../../museums/scoring';

/**
 * Game layer: individual missions, per-scan quiz and a per-museum ranking.
 *
 * Firestore layout (all scoring happens here, never in the browser):
 *   leaderboards/{museumId}/players/{userId}
 *     { name, points, missions: string[], completedWith: {missionId: title},
 *       artworks, quizCorrect, updatedAt }
 *   leaderboards/{museumId}/players/{userId}/artworks/{artworkKey}
 *     { title, artist, scanId, createdAt }   // dedupes "new artwork" points
 *   users/{userId}/scans/{scanId}.game  = { museumId, awards }
 *   users/{userId}/scans/{scanId}.quiz  = { questions (with answers), answers, language }
 */

export { POINTS, QUIZ_LENGTH };

const UNKNOWN_TITLES = new Set(['', 'unknown artwork', 'obra desconocida', 'obra desconhecida']);

export interface ArtFacts {
  title: string;
  artist?: string;
  year?: string;
  country?: string;
  style?: string;
  description?: string;
  funFact?: string;
}

export interface ScanAwards {
  points: number;
  newArtwork: boolean;
  missions: { id: string; points: number }[];
  totalPoints: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

// ─── Pure helpers ───────────────────────────────────────────────────────────

/** "Ana García López" → "Ana G." (no emails or full names on the ranking). */
export function displayName(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Visitor';
  if (parts.length === 1) return parts[0].slice(0, 24);
  return `${parts[0].slice(0, 24)} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** Stable id for "the same artwork" across scans: accent-free slug of title + artist. */
export function artworkKey(title: string, artist = ''): string {
  return `${title}|${artist}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140) || 'unknown';
}

export function isIdentified(art: ArtFacts): boolean {
  return !UNKNOWN_TITLES.has((art.title || '').trim().toLowerCase());
}

/** Competition ranking (1, 2, 2, 4) over points sorted descending. */
export function rankEntries<T extends { points: number }>(entries: T[]): (T & { rank: number })[] {
  let lastPoints: number | null = null;
  let lastRank = 0;
  return entries.map((e, i) => {
    const rank = lastPoints !== null && e.points === lastPoints ? lastRank : i + 1;
    lastPoints = e.points;
    lastRank = rank;
    return { ...e, rank };
  });
}

/** Fisher–Yates shuffle of the options, remapping the answer index. */
export function shuffleQuestion(q: QuizQuestion, random: () => number = Math.random): QuizQuestion {
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    answerIndex: order.indexOf(q.answerIndex),
  };
}

export function validQuestion(q: any): q is QuizQuestion {
  return !!(q && typeof q.question === 'string' && q.question.trim()
    && Array.isArray(q.options) && q.options.length === 4 && q.options.every((o: any) => typeof o === 'string' && o.trim())
    && Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < 4
    && typeof q.explanation === 'string');
}

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', es: 'Spanish', pt: 'Portuguese' };

function describeArt(art: ArtFacts): string {
  return [
    `Title: ${art.title}`,
    art.artist && `Artist: ${art.artist}`,
    art.year && `Year: ${art.year}`,
    art.country && `Country: ${art.country}`,
    art.style && `Style: ${art.style}`,
    art.description && `Description: ${art.description}`,
  ].filter(Boolean).join('\n');
}

async function generateJson(prompt: string, schema: Record<string, any>, temperature: number): Promise<any> {
  const result = await generateText({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature },
  }, (primary, status) => log.error('game', `Primary model ${primary} failed (${status}), using fallback`));
  if (!result.ok) throw new Error(result.data?.error?.message || `Vertex AI ${result.status}`);
  return JSON.parse(extractText(result.data) || '{}');
}

// ─── Missions ───────────────────────────────────────────────────────────────

/** Ask Gemini which of the open missions the identified artwork satisfies. */
export async function evaluateMissions(art: ArtFacts, missions: Mission[]): Promise<string[]> {
  if (missions.length === 0 || !isIdentified(art)) return [];
  const prompt = `You judge a museum scavenger hunt. Decide which missions the scanned artwork completes.

ARTWORK
${describeArt(art)}

MISSIONS
${missions.map((m) => `- id: ${m.id} | rule: ${m.criterion}`).join('\n')}

Include a mission only when the artwork clearly satisfies its rule, based on well-established facts about this specific artwork and artist. When unsure, leave it out.`;

  const schema = {
    type: 'OBJECT',
    properties: {
      matches: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { id: { type: 'STRING' }, reason: { type: 'STRING' } },
          required: ['id', 'reason'],
        },
      },
    },
    required: ['matches'],
  };
  const data = await generateJson(prompt, schema, 0);
  const known = new Set(missions.map((m) => m.id));
  return Array.from(new Set<string>((data.matches || []).map((m: any) => m.id).filter((id: string) => known.has(id))));
}

function playerRef(db: Firestore, museumId: string, userId: string) {
  return db.collection('leaderboards').doc(museumId).collection('players').doc(userId);
}

/** Award points for a saved scan: new artwork + any newly completed missions. */
export async function awardScan(
  db: Firestore,
  params: { userId: string; userName: string; museum: MuseumProfile; scanId: string; art: ArtFacts },
): Promise<ScanAwards> {
  const { userId, userName, museum, scanId, art } = params;
  const pRef = playerRef(db, museum.id, userId);
  const none: ScanAwards = { points: 0, newArtwork: false, missions: [], totalPoints: 0 };

  if (!isIdentified(art)) {
    const snap = await pRef.get();
    return { ...none, totalPoints: snap.data()?.points || 0 };
  }

  const aRef = pRef.collection('artworks').doc(artworkKey(art.title, art.artist));
  const [before, seen] = await Promise.all([pRef.get(), aRef.get()]);

  // Same artwork again: nothing new to earn, skip the model call
  if (seen.exists) {
    const repeat = { ...none, totalPoints: before.data()?.points || 0 };
    await db.collection('users').doc(userId).collection('scans').doc(scanId)
      .set({ game: { museumId: museum.id, awards: repeat } }, { merge: true });
    return repeat;
  }

  // Judge only missions this visitor hasn't completed yet (LLM call outside the transaction)
  const done = new Set<string>(before.data()?.missions || []);
  const open = museum.missions.filter((m) => !done.has(m.id));
  let matched: string[] = [];
  try {
    matched = await evaluateMissions(art, open);
  } catch (err: any) {
    log.error('game', `Mission evaluation failed: ${err.message}`);
  }

  const awards = await db.runTransaction(async (tx) => {
    const [pSnap, aSnap] = await Promise.all([tx.get(pRef), tx.get(aRef)]);
    const player = pSnap.data() || {};
    const completed = new Set<string>(player.missions || []);
    const newMissions = museum.missions.filter((m) => matched.includes(m.id) && !completed.has(m.id));
    const newArtwork = !aSnap.exists;
    const points = (newArtwork ? POINTS.newArtwork : 0) + newMissions.reduce((sum, m) => sum + m.points, 0);

    const update: Record<string, any> = {
      name: displayName(userName),
      points: FieldValue.increment(points),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (newArtwork) update.artworks = FieldValue.increment(1);
    if (newMissions.length) {
      update.missions = FieldValue.arrayUnion(...newMissions.map((m) => m.id));
      update.completedWith = Object.fromEntries(newMissions.map((m) => [m.id, art.title]));
    }
    tx.set(pRef, update, { merge: true });
    if (newArtwork) {
      tx.create(aRef, { title: art.title, artist: art.artist || '', scanId, createdAt: FieldValue.serverTimestamp() });
    }

    return {
      points,
      newArtwork,
      missions: newMissions.map((m) => ({ id: m.id, points: m.points })),
      totalPoints: (player.points || 0) + points,
    } satisfies ScanAwards;
  });

  await db.collection('users').doc(userId).collection('scans').doc(scanId)
    .set({ game: { museumId: museum.id, awards } }, { merge: true });
  return awards;
}

/** Award a stored scan once; repeated calls return the recorded awards. */
export async function awardStoredScan(
  db: Firestore,
  params: { userId: string; userName: string; scanId: string; resolveMuseum: (id?: string) => MuseumProfile },
): Promise<ScanAwards | null> {
  const { userId, userName, scanId, resolveMuseum } = params;
  const snap = await db.collection('users').doc(userId).collection('scans').doc(scanId).get();
  if (!snap.exists) return null;
  const scan = snap.data()!;
  if (scan.game?.awards) return scan.game.awards as ScanAwards;
  return awardScan(db, {
    userId,
    userName,
    museum: resolveMuseum(scan.museumId),
    scanId,
    art: {
      title: scan.artworkTitle, artist: scan.artist, year: scan.year, country: scan.country,
      style: scan.style, description: scan.description,
    },
  });
}

export async function getMissionsState(db: Firestore, userId: string, museum: MuseumProfile) {
  const snap = await playerRef(db, museum.id, userId).get();
  const player = snap.data() || {};
  const done = new Set<string>(player.missions || []);
  return {
    museumId: museum.id,
    points: player.points || 0,
    missions: museum.missions.map((m) => ({
      id: m.id,
      points: m.points,
      completed: done.has(m.id),
      completedWith: player.completedWith?.[m.id] || null,
    })),
  };
}

// ─── Ranking ────────────────────────────────────────────────────────────────

export async function getLeaderboard(db: Firestore, userId: string, museumId: string, limit = 50) {
  const players = db.collection('leaderboards').doc(museumId).collection('players');
  const [top, totalSnap, meSnap] = await Promise.all([
    players.orderBy('points', 'desc').limit(limit).get(),
    players.count().get(),
    players.doc(userId).get(),
  ]);

  const entries = rankEntries(top.docs.map((d) => ({
    userId: d.id,
    name: d.data().name || 'Visitor',
    points: d.data().points || 0,
    missions: (d.data().missions || []).length,
  }))).map(({ userId: id, ...e }) => ({ ...e, isYou: id === userId }));

  let you: { rank: number; points: number; missions: number } | null = null;
  const mine = entries.find((e) => e.isYou);
  if (mine) {
    you = { rank: mine.rank, points: mine.points, missions: mine.missions };
  } else if (meSnap.exists) {
    const myPoints = meSnap.data()?.points || 0;
    const ahead = await players.where('points', '>', myPoints).count().get();
    you = { rank: ahead.data().count + 1, points: myPoints, missions: (meSnap.data()?.missions || []).length };
  }

  return { museumId, entries, you, totalPlayers: totalSnap.data().count };
}

// ─── Quiz ───────────────────────────────────────────────────────────────────

function publicQuiz(quiz: any) {
  return {
    questions: (quiz.questions || []).map((q: QuizQuestion) => ({ question: q.question, options: q.options })),
    answers: quiz.answers || {},
    pointsPerQuestion: POINTS.quizCorrect,
    perfectBonus: POINTS.quizPerfectBonus,
  };
}

/** Return the scan's quiz, generating and storing it on first request. */
export async function getOrCreateQuiz(db: Firestore, userId: string, scanId: string, language: string) {
  const ref = db.collection('users').doc(userId).collection('scans').doc(scanId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const scan = snap.data()!;
  if (scan.quiz?.questions?.length) return publicQuiz(scan.quiz);

  const deep = scan.deepAnalysis || {};
  const facts = [
    describeArt({
      title: scan.artworkTitle, artist: scan.artist, year: scan.year, country: scan.country,
      style: scan.style, description: scan.description,
    }),
    scan.funFact && `Fun fact: ${scan.funFact}`,
    deep.historicalContext && `Historical context: ${deep.historicalContext}`,
    deep.technicalAnalysis && `Technique: ${deep.technicalAnalysis}`,
    deep.symbolism && `Symbolism: ${deep.symbolism}`,
    deep.curiosities?.length && `Curiosities: ${deep.curiosities.join(' | ')}`,
  ].filter(Boolean).join('\n');

  const langName = LANGUAGE_NAMES[language] || 'English';
  const prompt = `Create a ${QUIZ_LENGTH}-question multiple-choice quiz for a museum visitor who has just scanned this artwork and read about it.

${facts}

Rules:
- Each question has exactly 4 options and exactly one correct answer (answerIndex, 0-based).
- Base every question on well-established facts about this artwork, preferring the facts above.
- Mix topics: the artist, the context or history, and something to look for in the work.
- Keep questions short (max 20 words) and fun; no trick questions.
- "explanation" is one sentence telling why the answer is right.
- Write everything in ${langName}.`;

  const schema = {
    type: 'OBJECT',
    properties: {
      questions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            question: { type: 'STRING' },
            options: { type: 'ARRAY', items: { type: 'STRING' } },
            answerIndex: { type: 'INTEGER' },
            explanation: { type: 'STRING' },
          },
          required: ['question', 'options', 'answerIndex', 'explanation'],
        },
      },
    },
    required: ['questions'],
  };

  const data = await generateJson(prompt, schema, 0.7);
  const questions: QuizQuestion[] = (data.questions || []).filter(validQuestion).slice(0, QUIZ_LENGTH).map((q: QuizQuestion) => shuffleQuestion(q));
  if (questions.length < QUIZ_LENGTH) throw new Error('Quiz generation returned too few valid questions');

  const quiz = { questions, answers: {}, language, createdAt: FieldValue.serverTimestamp() };
  // Another request may have created it meanwhile: keep the first one
  const stored = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (fresh.data()?.quiz?.questions?.length) return fresh.data()!.quiz;
    tx.update(ref, { quiz });
    return quiz;
  });
  return publicQuiz(stored);
}

export type AnswerResult =
  | { status: 'ok'; correct: boolean; correctIndex: number; explanation: string; pointsAwarded: number; bonus: number; totalPoints: number; finished: boolean }
  | { status: 'not_found' | 'no_quiz' | 'already_answered' | 'bad_request' };

/** Record one answer (once per question) and award points to the museum ranking. */
export async function answerQuiz(
  db: Firestore,
  params: { userId: string; userName: string; scanId: string; questionIndex: number; choice: number; fallbackMuseumId: string },
): Promise<AnswerResult> {
  const { userId, userName, scanId, questionIndex, choice, fallbackMuseumId } = params;
  if (!Number.isInteger(questionIndex) || !Number.isInteger(choice) || choice < 0 || choice > 3) {
    return { status: 'bad_request' };
  }
  const scanRef = db.collection('users').doc(userId).collection('scans').doc(scanId);

  return db.runTransaction(async (tx): Promise<AnswerResult> => {
    const snap = await tx.get(scanRef);
    if (!snap.exists) return { status: 'not_found' };
    const scan = snap.data()!;
    const quiz = scan.quiz;
    if (!quiz?.questions?.length) return { status: 'no_quiz' };
    const q: QuizQuestion | undefined = quiz.questions[questionIndex];
    if (!q) return { status: 'bad_request' };
    const answers = { ...(quiz.answers || {}) };
    if (answers[questionIndex] !== undefined) return { status: 'already_answered' };

    const museumId = scan.game?.museumId || fallbackMuseumId;
    const pRef = playerRef(db, museumId, userId);
    const pSnap = await tx.get(pRef);

    const correct = choice === q.answerIndex;
    answers[questionIndex] = { choice, correct };
    const finished = Object.keys(answers).length === quiz.questions.length;
    const perfect = finished && Object.values(answers).every((a: any) => a.correct);
    const pointsAwarded = correct ? POINTS.quizCorrect : 0;
    const bonus = perfect ? POINTS.quizPerfectBonus : 0;

    tx.update(scanRef, { [`quiz.answers.${questionIndex}`]: { choice, correct } });
    if (pointsAwarded + bonus > 0) {
      tx.set(pRef, {
        name: displayName(userName),
        points: FieldValue.increment(pointsAwarded + bonus),
        quizCorrect: FieldValue.increment(correct ? 1 : 0),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    return {
      status: 'ok',
      correct,
      correctIndex: q.answerIndex,
      explanation: q.explanation,
      pointsAwarded,
      bonus,
      totalPoints: (pSnap.data()?.points || 0) + pointsAwarded + bonus,
      finished,
    };
  });
}

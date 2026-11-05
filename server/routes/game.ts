import { Router, Request, Response } from 'express';
import { getFirestore } from '../services/firestore';
import { getMissionsState, getLeaderboard, getOrCreateQuiz, answerQuiz, awardStoredScan } from '../services/game';
import { getMuseumById } from '../../museums';
import { config } from '../config';
import { log } from '../utils/logger';

const router = Router();

/** The museum a request plays in: ?museum= / body.museumId (testing override) or the deployment's. */
function museumFor(req: Request) {
  const requested = (req.query.museum as string) || req.body?.museumId;
  return getMuseumById(requested || config.museumId);
}

async function userProfile(userId: string): Promise<{ name: string; language: string }> {
  const doc = await getFirestore().collection('users').doc(userId).get();
  const data = doc.data() || {};
  return { name: data.name || 'Visitor', language: data.language || 'en' };
}

// POST /api/game/scans/:scanId/award — score a saved scan (idempotent)
router.post('/scans/:scanId/award', async (req: Request<{ scanId: string }>, res: Response) => {
  try {
    const profile = await userProfile(req.userId!);
    const awards = await awardStoredScan(getFirestore(), {
      userId: req.userId!,
      userName: profile.name,
      scanId: req.params.scanId,
      resolveMuseum: (id) => getMuseumById(id || config.museumId),
    });
    if (!awards) {
      res.status(404).json({ error: 'Scan not found' });
      return;
    }
    log.info('game', 'Scan awards', { user: req.userId!.slice(0, 8), points: awards.points, missions: awards.missions.map((m) => m.id) });
    res.json(awards);
  } catch (err: any) {
    log.error('game', `award: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/game/missions?museum= — mission status for the current visitor
router.get('/missions', async (req: Request, res: Response) => {
  try {
    res.json(await getMissionsState(getFirestore(), req.userId!, museumFor(req)));
  } catch (err: any) {
    log.error('game', `missions: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/game/leaderboard?museum= — individual ranking (top 50 + your position)
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    res.json(await getLeaderboard(getFirestore(), req.userId!, museumFor(req).id));
  } catch (err: any) {
    log.error('game', `leaderboard: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/game/quiz/:scanId — get (or generate) the 3-question quiz for a scan
router.post('/quiz/:scanId', async (req: Request<{ scanId: string }>, res: Response) => {
  try {
    const profile = await userProfile(req.userId!);
    const language = ['en', 'es', 'pt'].includes(req.body?.language) ? req.body.language : profile.language;
    const quiz = await getOrCreateQuiz(getFirestore(), req.userId!, req.params.scanId, language);
    if (!quiz) {
      res.status(404).json({ error: 'Scan not found' });
      return;
    }
    res.json(quiz);
  } catch (err: any) {
    log.error('game', `quiz: ${err.message}`);
    res.status(502).json({ error: 'Could not create the quiz. Try again.' });
  }
});

// POST /api/game/quiz/:scanId/answer { questionIndex, choice }
router.post('/quiz/:scanId/answer', async (req: Request<{ scanId: string }>, res: Response) => {
  try {
    const profile = await userProfile(req.userId!);
    const result = await answerQuiz(getFirestore(), {
      userId: req.userId!,
      userName: profile.name,
      scanId: req.params.scanId,
      questionIndex: Number(req.body?.questionIndex),
      choice: Number(req.body?.choice),
      fallbackMuseumId: museumFor(req).id,
    });
    switch (result.status) {
      case 'ok': {
        const { status, ...body } = result;
        res.json(body);
        return;
      }
      case 'not_found': res.status(404).json({ error: 'Scan not found' }); return;
      case 'no_quiz': res.status(409).json({ error: 'Quiz not started' }); return;
      case 'already_answered': res.status(409).json({ error: 'Question already answered' }); return;
      default: res.status(400).json({ error: 'Invalid answer' });
    }
  } catch (err: any) {
    log.error('game', `answer: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

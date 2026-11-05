import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadBuffer } from '../services/storage';
import { getFirestore } from '../services/firestore';
import { log } from '../utils/logger';

const router = Router();

const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // ~80 s of 24 kHz mono 16-bit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter: (_req, file, cb) => cb(null, ['audio/wav', 'audio/x-wav', 'audio/wave'].includes(file.mimetype)),
});

interface SentenceIn { text?: unknown; charStart?: unknown; start?: unknown }

function sanitizeSentences(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 40).map((s: SentenceIn) => ({
    text: typeof s.text === 'string' ? s.text.slice(0, 600) : '',
    charStart: Number.isFinite(Number(s.charStart)) ? Number(s.charStart) : 0,
    start: Number.isFinite(Number(s.start)) ? Math.max(0, Number(s.start)) : 0,
  })).filter((s) => s.text);
}

// POST /api/scans/:scanId/narration — store the intro narration (WAV + transcript + sentence timings)
router.post('/:scanId/narration', upload.single('audio'), async (req: Request<{ scanId: string }>, res: Response) => {
  try {
    const userId = req.userId!;
    const { scanId } = req.params;
    if (!req.file) {
      res.status(400).json({ error: 'Missing WAV "audio"' });
      return;
    }
    let meta: any = {};
    try {
      meta = JSON.parse(String(req.body?.meta || '{}'));
    } catch {
      res.status(400).json({ error: 'Invalid "meta"' });
      return;
    }

    const db = getFirestore();
    const ref = db.collection('users').doc(userId).collection('scans').doc(scanId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Scan not found' });
      return;
    }

    const audioPath = `users/${userId}/narrations/${scanId}.wav`;
    await uploadBuffer(req.file.buffer, audioPath, 'audio/wav');
    const narration = {
      audioPath,
      script: typeof meta.script === 'string' ? meta.script.slice(0, 4000) : '',
      sentences: sanitizeSentences(meta.sentences),
      durationSec: Number.isFinite(Number(meta.durationSec)) ? Number(meta.durationSec) : 0,
    };
    await ref.set({ narration }, { merge: true });
    log.info('narration', 'Saved', { user: userId.slice(0, 8), seconds: narration.durationSec, kb: Math.round(req.file.size / 1024) });
    res.status(201).json({ audioUrl: `/api/images/${audioPath}` });
  } catch (err: any) {
    log.error('narration', `save: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getFirestore, FieldValue } from '../services/firestore';

const router = Router();

// POST /api/scans — Save a scan result
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { artData, capturedImageUrl, language } = req.body;

    if (!artData || !artData.title) {
      res.status(400).json({ error: 'Missing or invalid "artData"' });
      return;
    }

    const scanId = uuidv4();
    const db = getFirestore();

    await db.collection('users').doc(userId).collection('scans').doc(scanId).set({
      artworkTitle: artData.title,
      artist: artData.artist || '',
      year: artData.year || '',
      country: artData.country || '',
      style: artData.style || '',
      description: artData.description || '',
      funFact: artData.funFact || '',
      sources: artData.sources || [],
      annotations: artData.annotations || [],
      capturedImageUrl: capturedImageUrl || '',
      language: language || 'en',
      createdAt: FieldValue.serverTimestamp(),
    });

    // Update user's lastActiveAt
    await db.collection('users').doc(userId).update({
      lastActiveAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json({ scanId });
  } catch (err) {
    console.error('Create scan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Note: GET /api/users/:userId/scans is in routes/users.ts (mounted under /api/users)

// PATCH /api/scans/:scanId/deep-analysis — Update with deep analysis
router.patch('/:scanId/deep-analysis', async (req: Request<{ scanId: string }>, res: Response) => {
  try {
    const userId = req.userId!;
    const { scanId } = req.params;
    const { deepAnalysis } = req.body;

    if (!deepAnalysis) {
      res.status(400).json({ error: 'Missing "deepAnalysis"' });
      return;
    }

    const db = getFirestore();
    const docRef = db.collection('users').doc(userId).collection('scans').doc(scanId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: 'Scan not found' });
      return;
    }

    await docRef.update({ deepAnalysis });
    res.json({ ok: true });
  } catch (err) {
    console.error('Update deep analysis error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

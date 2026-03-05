import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getFirestore, FieldValue } from '../services/firestore';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const VALID_PERSONAS = ['guide', 'academic', 'blogger'];
const VALID_LANGUAGES = ['en', 'pt', 'es'];

// POST /api/users — Create user at onboarding (no auth required)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, persona, language } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Missing or invalid "name"' });
      return;
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ error: 'Missing or invalid "email"' });
      return;
    }
    if (!VALID_PERSONAS.includes(persona)) {
      res.status(400).json({ error: `Invalid "persona". Must be one of: ${VALID_PERSONAS.join(', ')}` });
      return;
    }
    if (!VALID_LANGUAGES.includes(language)) {
      res.status(400).json({ error: `Invalid "language". Must be one of: ${VALID_LANGUAGES.join(', ')}` });
      return;
    }

    const userId = uuidv4();
    const db = getFirestore();

    await db.collection('users').doc(userId).set({
      name: name.trim(),
      email: email.trim(),
      persona,
      language,
      selfieUrl: '',
      createdAt: FieldValue.serverTimestamp(),
      lastActiveAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json({ userId });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:userId — Get user profile (auth required)
router.get('/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (req.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const db = getFirestore();
    const doc = await db.collection('users').doc(userId).get();

    if (!doc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const data = doc.data()!;
    res.json({
      userId,
      name: data.name,
      email: data.email,
      persona: data.persona,
      language: data.language,
      selfieUrl: data.selfieUrl,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      lastActiveAt: data.lastActiveAt?.toDate?.()?.toISOString() || null,
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:userId — Update user profile (auth required)
router.patch('/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (req.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const allowedFields = ['persona', 'language', 'selfieUrl', 'name', 'email'];
    const updates: Record<string, any> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'persona' && !VALID_PERSONAS.includes(req.body[field])) {
          res.status(400).json({ error: `Invalid "persona". Must be one of: ${VALID_PERSONAS.join(', ')}` });
          return;
        }
        if (field === 'language' && !VALID_LANGUAGES.includes(req.body[field])) {
          res.status(400).json({ error: `Invalid "language". Must be one of: ${VALID_LANGUAGES.join(', ')}` });
          return;
        }
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    updates.lastActiveAt = FieldValue.serverTimestamp();

    const db = getFirestore();
    const docRef = db.collection('users').doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await docRef.update(updates);
    res.json({ ok: true });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:userId/scans — List scan history (auth required)
router.get('/:userId/scans', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (req.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const db = getFirestore();
    const snapshot = await db
      .collection('users').doc(userId).collection('scans')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const scans = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        scanId: doc.id,
        artworkTitle: data.artworkTitle,
        artist: data.artist,
        year: data.year,
        style: data.style,
        capturedImageUrl: data.capturedImageUrl,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        language: data.language,
      };
    });

    res.json({ scans });
  } catch (err) {
    console.error('List scans error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getFirestore, FieldValue } from '../services/firestore';

const router = Router();

// POST /api/scans/:scanId/chats — Save a chat message
router.post('/:scanId/chats', async (req: Request<{ scanId: string }>, res: Response) => {
  try {
    const userId = req.userId!;
    const { scanId } = req.params;
    const { role, text, isAudioTranscription } = req.body;

    if (!['user', 'model'].includes(role)) {
      res.status(400).json({ error: 'Invalid "role". Must be "user" or "model".' });
      return;
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Missing or empty "text"' });
      return;
    }

    const messageId = uuidv4();
    const db = getFirestore();

    await db
      .collection('users').doc(userId)
      .collection('scans').doc(scanId)
      .collection('chats').doc(messageId)
      .set({
        role,
        text: text.trim(),
        isAudioTranscription: isAudioTranscription || false,
        createdAt: FieldValue.serverTimestamp(),
      });

    res.status(201).json({ messageId });
  } catch (err) {
    console.error('Save chat message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/scans/:scanId/chats — Load chat history
router.get('/:scanId/chats', async (req: Request<{ scanId: string }>, res: Response) => {
  try {
    const userId = req.userId!;
    const { scanId } = req.params;

    const db = getFirestore();
    const snapshot = await db
      .collection('users').doc(userId)
      .collection('scans').doc(scanId)
      .collection('chats')
      .orderBy('createdAt', 'asc')
      .get();

    const messages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        messageId: doc.id,
        role: data.role,
        text: data.text,
        isAudioTranscription: data.isAudioTranscription,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    res.json({ messages });
  } catch (err) {
    console.error('Load chat history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

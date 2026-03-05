import { Request, Response, NextFunction } from 'express';
import { getFirestore } from '../services/firestore';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = req.headers['x-user-id'] as string | undefined;

  if (!userId) {
    res.status(401).json({ error: 'Missing X-User-Id header' });
    return;
  }

  try {
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      res.status(401).json({ error: 'Unknown user' });
      return;
    }

    req.userId = userId;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

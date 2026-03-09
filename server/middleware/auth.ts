import { Request, Response, NextFunction } from 'express';
import { getFirestore } from '../services/firestore';
import { log } from '../utils/logger';

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
    log.debug('auth', `Missing X-User-Id on ${req.method} ${req.path}`);
    res.status(401).json({ error: 'Missing X-User-Id header' });
    return;
  }

  try {
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      log.warn('auth', `Unknown user ${userId.slice(0, 8)}… on ${req.method} ${req.path}`);
      res.status(401).json({ error: 'Unknown user' });
      return;
    }

    req.userId = userId;
    next();
  } catch (err: any) {
    log.error('auth', `Middleware error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
}

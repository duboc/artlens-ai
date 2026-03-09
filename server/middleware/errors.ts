import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  log.error('unhandled', `${req.method} ${req.path}: ${err.message}`, { stack: err.stack?.split('\n').slice(0, 3).join(' | ') });
  res.status(500).json({ error: 'Internal server error' });
}

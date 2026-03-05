import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { uploadBuffer, getSignedUrl } from '../services/storage';

const router = Router();

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// POST /api/images/upload — Upload an image
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const { type, scanId } = req.body;
    const userId = req.userId!;

    if (!file) {
      res.status(400).json({ error: 'Missing file' });
      return;
    }

    if (!['selfie', 'scan', 'generated'].includes(type)) {
      res.status(400).json({ error: 'Invalid "type". Must be one of: selfie, scan, generated' });
      return;
    }

    if (type === 'scan' && !scanId) {
      res.status(400).json({ error: 'Missing "scanId" for scan type' });
      return;
    }

    // Determine storage path
    let destination: string;
    switch (type) {
      case 'selfie':
        destination = `users/${userId}/selfie.jpg`;
        break;
      case 'scan':
        destination = `users/${userId}/scans/${scanId}.jpg`;
        break;
      case 'generated':
        destination = `users/${userId}/generated/${uuidv4()}.png`;
        break;
      default:
        res.status(400).json({ error: 'Invalid type' });
        return;
    }

    const url = await uploadBuffer(file.buffer, destination, file.mimetype);
    res.json({ url });
  } catch (err: any) {
    if (err.message?.includes('Unsupported file type')) {
      res.status(415).json({ error: err.message });
      return;
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File too large. Maximum size is 5MB.' });
      return;
    }
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/images/* — Serve image via signed URL redirect
router.get('/*', async (req: Request, res: Response) => {
  try {
    const path = req.params[0];
    const userId = req.userId!;

    if (!path) {
      res.status(400).json({ error: 'Missing image path' });
      return;
    }

    // Users can only access their own images
    if (!path.startsWith(`users/${userId}/`)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const url = await getSignedUrl(path);
    res.redirect(302, url);
  } catch (err: any) {
    if (err.message === 'File not found') {
      res.status(404).json({ error: 'Image not found' });
      return;
    }
    console.error('Get image error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

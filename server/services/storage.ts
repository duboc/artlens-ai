import { Storage } from '@google-cloud/storage';
import { pipeline } from 'stream/promises';
import { config } from '../config';

let storage: Storage | null = null;

function getStorage(): Storage {
  if (!storage) {
    storage = new Storage({
      projectId: config.projectId || undefined,
    });
  }
  return storage;
}

export function getBucket() {
  return getStorage().bucket(config.bucket);
}

export async function uploadBuffer(
  buffer: Buffer,
  destination: string,
  contentType: string
): Promise<string> {
  const bucket = getBucket();
  const file = bucket.file(destination);

  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  });

  return destination;
}

export async function downloadBuffer(path: string): Promise<Buffer> {
  const bucket = getBucket();
  const file = bucket.file(path);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error('File not found');
  }

  const [contents] = await file.download();
  return contents;
}

// Stream a file from GCS to an HTTP response (works with any ADC credential).
// Supports a single byte range (HTTP 206): Safari requires it to play <audio>.
export async function streamToResponse(
  path: string,
  res: import('express').Response,
  rangeHeader?: string,
): Promise<void> {
  const bucket = getBucket();
  const file = bucket.file(path);

  // getMetadata() rejects with code 404 when the object doesn't exist
  let metadata;
  try {
    [metadata] = await file.getMetadata();
  } catch (err: any) {
    if (err?.code === 404) throw new Error('File not found');
    throw err;
  }

  const size = Number(metadata.size || 0);
  res.set('Content-Type', metadata.contentType || 'application/octet-stream');
  res.set('Cache-Control', 'private, max-age=3600');
  res.set('Accept-Ranges', 'bytes');

  let stream = file.createReadStream();
  const range = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && size > 0) {
    let start = range[1] === '' ? size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) {
      res.status(416).set('Content-Range', `bytes */${size}`).end();
      return;
    }
    res.status(206);
    res.set('Content-Range', `bytes ${start}-${end}/${size}`);
    res.set('Content-Length', String(end - start + 1));
    stream = file.createReadStream({ start, end });
  } else if (size > 0) {
    res.set('Content-Length', String(size));
  }

  // pipeline() destroys both streams on error instead of emitting an
  // unhandled 'error' event (which would crash the process).
  await pipeline(stream, res).catch((err) => {
    if (!res.headersSent) throw err;
    res.destroy(err);
  });
}

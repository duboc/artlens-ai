import { Storage } from '@google-cloud/storage';
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

export async function getSignedUrl(path: string): Promise<string> {
  const bucket = getBucket();
  const file = bucket.file(path);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error('File not found');
  }

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  });

  return url;
}

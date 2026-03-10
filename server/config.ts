export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || '',
  bucket: process.env.GCS_BUCKET || '',
  firestoreDb: process.env.FIRESTORE_DATABASE || '(default)',
  vertex: {
    regionText: process.env.VERTEX_REGION_TEXT || 'global',
    regionLive: process.env.VERTEX_REGION_LIVE || 'us-central1',
    modelText: process.env.MODEL_TEXT || 'gemini-3.1-flash-lite-preview',
    modelTextFallback: process.env.MODEL_TEXT_FALLBACK || 'gemini-3-flash-preview',
    modelLive: process.env.MODEL_LIVE || 'gemini-live-2.5-flash-native-audio',
    modelImage: process.env.MODEL_IMAGE || 'gemini-3.1-flash-image-preview',
    regionImage: process.env.VERTEX_REGION_IMAGE || 'global',
    modelTts: process.env.MODEL_TTS || 'gemini-2.5-flash-tts',
    regionTts: process.env.VERTEX_REGION_TTS || 'us-central1',
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
};

// Warn about missing critical config at startup (plain console since logger isn't imported here)
if (!config.projectId) {
  console.warn('\x1b[33m⚠️  GOOGLE_CLOUD_PROJECT not set — Vertex AI calls will fail\x1b[0m');
}
if (!config.bucket) {
  console.warn('\x1b[33m⚠️  GCS_BUCKET not set — image uploads will fail\x1b[0m');
}

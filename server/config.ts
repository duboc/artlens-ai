export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || '',
  bucket: process.env.GCS_BUCKET || '',
  firestoreDb: process.env.FIRESTORE_DATABASE || '(default)',
  vertex: {
    regionText: process.env.VERTEX_REGION_TEXT || 'global',
    regionLive: process.env.VERTEX_REGION_LIVE || 'us-central1',
    regionImage: process.env.VERTEX_REGION_IMAGE || 'global',
    modelText: process.env.MODEL_TEXT || 'gemini-3.5-flash-lite',
    modelTextFallback: process.env.MODEL_TEXT_FALLBACK || 'gemini-3.8-flash',
    modelLive: process.env.MODEL_LIVE || 'gemini-3.8-live',
    modelImage: process.env.MODEL_IMAGE || 'gemini-3.1-flash-image',
    // Default thinking level for text calls (MINIMAL | LOW | MEDIUM | HIGH).
    // LOW keeps identification fast; set to '' to use the model default.
    thinkingLevel: process.env.THINKING_LEVEL ?? 'LOW',
    // Upper bound for a single Vertex AI REST call.
    requestTimeoutMs: parseInt(process.env.VERTEX_TIMEOUT_MS || '45000', 10),
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

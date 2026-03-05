export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || '',
  bucket: process.env.GCS_BUCKET || '',
  firestoreDb: process.env.FIRESTORE_DATABASE || '(default)',
  vertex: {
    regionText: process.env.VERTEX_REGION_TEXT || 'global',
    regionLive: process.env.VERTEX_REGION_LIVE || 'us-central1',
    modelText: process.env.MODEL_TEXT || 'gemini-3-flash-preview',
    modelLive: process.env.MODEL_LIVE || 'gemini-live-2.5-flash-native-audio',
    modelImage: process.env.MODEL_IMAGE || 'gemini-2.0-flash-exp',
    regionImage: process.env.VERTEX_REGION_IMAGE || 'us-central1',
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
};

// Warn about missing critical config at startup
if (!config.projectId) {
  console.warn('⚠️  GOOGLE_CLOUD_PROJECT not set — Vertex AI calls will fail');
}
if (!config.bucket) {
  console.warn('⚠️  GCS_BUCKET not set — image uploads will fail');
}

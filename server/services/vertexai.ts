import { GoogleAuth } from 'google-auth-library';
import { config } from '../config';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

let cachedClient: Awaited<ReturnType<typeof auth.getClient>> | null = null;

async function getClient() {
  if (!cachedClient) {
    cachedClient = await auth.getClient();
  }
  return cachedClient;
}

export async function getAccessToken(): Promise<string> {
  const client = await getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error('Failed to obtain access token');
  }
  return tokenResponse.token;
}

export function getGenerateUrl(model?: string): string {
  const region = config.vertex.regionText;
  const modelName = model || config.vertex.modelText;
  const host = region === 'global'
    ? 'aiplatform.googleapis.com'
    : `${region}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${config.projectId}/locations/${region}/publishers/google/models/${modelName}:generateContent`;
}

export function getImageGenerateUrl(): string {
  const region = config.vertex.regionImage;
  const model = config.vertex.modelImage;
  const host = region === 'global'
    ? 'aiplatform.googleapis.com'
    : `${region}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${config.projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
}

export function getLiveWebSocketUrl(): string {
  const region = config.vertex.regionLive;
  return `wss://${region}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
}

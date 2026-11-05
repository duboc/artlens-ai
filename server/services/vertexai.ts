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

function generateContentUrl(region: string, model: string): string {
  const host = region === 'global'
    ? 'aiplatform.googleapis.com'
    : `${region}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${config.projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
}

export function getGenerateUrl(model: string = config.vertex.modelText): string {
  return generateContentUrl(config.vertex.regionText, model);
}

export function getImageGenerateUrl(): string {
  return generateContentUrl(config.vertex.regionImage, config.vertex.modelImage);
}

export function getLiveWebSocketUrl(): string {
  const region = config.vertex.regionLive;
  return `wss://${region}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
}

export function getLiveModelPath(): string {
  return `projects/${config.projectId}/locations/${config.vertex.regionLive}/publishers/google/models/${config.vertex.modelLive}`;
}

// ─── Text generation with fallback ──────────────────────────────────────────

// Statuses where retrying on the fallback model can help. 4xx client errors
// (bad request, permission) will fail the same way on any model.
const RETRYABLE_STATUSES = new Set([404, 408, 429, 500, 502, 503, 504]);

export interface GenerateMeta {
  /** Model that produced the answer (after any fallback). */
  model: string;
  fallbackUsed: boolean;
  /** Server-side wall-clock time for the whole call, including any fallback. */
  latencyMs: number;
  thinkingLevel: string | null;
}

export interface GenerateResult {
  ok: boolean;
  status: number;
  data: any;
  meta: GenerateMeta;
}

async function callVertexAI(
  url: string,
  token: string,
  body: Record<string, any>,
): Promise<{ ok: boolean; status: number; data: any }> {
  let vertexResponse: globalThis.Response;
  try {
    vertexResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.vertex.requestTimeoutMs),
    });
  } catch (err: any) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      data: { error: { message: timedOut ? `Vertex AI timed out after ${config.vertex.requestTimeoutMs}ms` : err?.message } },
    };
  }

  const responseText = await vertexResponse.text();
  try {
    return { ok: vertexResponse.ok, status: vertexResponse.status, data: JSON.parse(responseText) };
  } catch {
    return { ok: false, status: 502, data: { error: { message: 'Vertex AI returned non-JSON: ' + responseText.slice(0, 200) } } };
  }
}

/**
 * Call the configured text model, retrying once on the fallback model for
 * transient / not-found errors. Applies the default thinking level unless the
 * body sets its own thinkingConfig. `onFallback` lets callers log the switch.
 */
export async function generateText(
  body: Record<string, any>,
  onFallback?: (primary: string, status: number, message?: string) => void,
): Promise<GenerateResult> {
  const vertexBody: Record<string, any> = {
    ...body,
    generationConfig: { ...(body.generationConfig || {}) },
  };
  if (config.vertex.thinkingLevel && !vertexBody.generationConfig.thinkingConfig) {
    vertexBody.generationConfig.thinkingConfig = { thinkingLevel: config.vertex.thinkingLevel };
  }
  const thinkingLevel = vertexBody.generationConfig.thinkingConfig?.thinkingLevel ?? null;

  const start = Date.now();
  const token = await getAccessToken();
  let model = config.vertex.modelText;
  let fallbackUsed = false;
  let result = await callVertexAI(getGenerateUrl(model), token, vertexBody);

  const fallback = config.vertex.modelTextFallback;
  if (!result.ok && fallback && fallback !== model && RETRYABLE_STATUSES.has(result.status)) {
    onFallback?.(model, result.status, result.data?.error?.message);
    model = fallback;
    fallbackUsed = true;
    result = await callVertexAI(getGenerateUrl(model), token, vertexBody);
  }

  return {
    ...result,
    meta: { model, fallbackUsed, latencyMs: Date.now() - start, thinkingLevel },
  };
}

/** Concatenate the non-thought text parts of the first candidate. */
export function extractText(data: any): string {
  const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
  return parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
}

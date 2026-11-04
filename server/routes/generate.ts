import { Router, Request, Response } from 'express';
import { getAccessToken, getGenerateUrl } from '../services/vertexai';
import { config } from '../config';
import { log } from '../utils/logger';

const router = Router();

// Only built-in tools the app actually uses may be forwarded to Vertex AI.
const ALLOWED_TOOLS = new Set(['google_search', 'googleSearch']);

// Statuses where retrying on the fallback model can help. 4xx client errors
// (bad request, permission) will fail the same way on any model.
const RETRYABLE_STATUSES = new Set([404, 408, 429, 500, 502, 503, 504]);

// Call Vertex AI generateContent and return parsed response
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
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    return { ok: false, status: 502, data: { error: { message: 'Vertex AI returned non-JSON: ' + responseText.slice(0, 200) } } };
  }

  return { ok: vertexResponse.ok, status: vertexResponse.status, data };
}

// POST /api/generate — Forward text generation to Vertex AI.
// The model is always chosen server-side (config.vertex.modelText) so clients
// cannot pick arbitrary (or more expensive) models.
router.post('/', async (req: Request, res: Response) => {
  try {
    const { contents, generationConfig, tools, systemInstruction } = req.body;

    // Normalize contents: wrap single object in array, default role to "user"
    let normalizedContents = contents;
    if (contents && !Array.isArray(contents)) {
      normalizedContents = [contents];
    }
    if (!Array.isArray(normalizedContents) || normalizedContents.length === 0) {
      res.status(400).json({ error: 'Missing "contents"' });
      return;
    }
    normalizedContents = normalizedContents.map((c: any) => ({
      role: c.role || 'user',
      ...c,
    }));

    if (tools !== undefined) {
      const valid = Array.isArray(tools) && tools.every(
        (t: any) => t && typeof t === 'object' && Object.keys(t).every((k) => ALLOWED_TOOLS.has(k)),
      );
      if (!valid) {
        res.status(400).json({ error: 'Unsupported "tools"' });
        return;
      }
    }

    // Build Vertex AI request body
    const vertexBody: Record<string, any> = {
      contents: normalizedContents,
      generationConfig: { ...(generationConfig || {}) },
    };
    if (config.vertex.thinkingLevel && !vertexBody.generationConfig.thinkingConfig) {
      vertexBody.generationConfig.thinkingConfig = { thinkingLevel: config.vertex.thinkingLevel };
    }
    if (tools) vertexBody.tools = tools;
    if (systemInstruction) vertexBody.systemInstruction = systemInstruction;

    const usedModel = config.vertex.modelText;
    const hasTools = !!(tools && tools.length);
    const hasImage = normalizedContents.some((c: any) => c.parts?.some((p: any) => p.inlineData));
    const turnCount = normalizedContents.length;

    log.info('generate', `→ ${usedModel}`, {
      turns: turnCount,
      tools: hasTools,
      image: hasImage,
    });

    const startTime = Date.now();
    const token = await getAccessToken();

    let result = await callVertexAI(getGenerateUrl(usedModel), token, vertexBody);

    // Fallback: retry once on the fallback model for transient / not-found errors
    const fallbackModel = config.vertex.modelTextFallback;
    if (!result.ok && fallbackModel && fallbackModel !== usedModel && RETRYABLE_STATUSES.has(result.status)) {
      log.error('generate', `Primary model ${usedModel} failed (${result.status}), retrying with ${fallbackModel}`, {
        error: result.data?.error?.message,
      });
      result = await callVertexAI(getGenerateUrl(fallbackModel), token, vertexBody);
    }

    const elapsed = Date.now() - startTime;

    if (!result.ok) {
      const status = [400, 403, 429, 504].includes(result.status) ? result.status : 502;
      log.error('generate', `← ${status} in ${elapsed}ms`, {
        error: result.data?.error?.message,
      });
      res.status(status).json({
        error: result.data?.error?.message || 'Vertex AI request failed',
      });
      return;
    }

    // Add convenience top-level text field (skip thought parts, join the rest)
    const parts: any[] = result.data?.candidates?.[0]?.content?.parts || [];
    const text = parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
    log.info('generate', `← 200 in ${elapsed}ms`, {
      chars: text.length,
    });
    res.json({ text, ...result.data });
  } catch (err: any) {
    log.error('generate', `Exception: ${err.message}`);
    res.status(502).json({ error: 'Failed to forward request to Vertex AI' });
  }
});

export default router;

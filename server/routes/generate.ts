import { Router, Request, Response } from 'express';
import { generateText, extractText } from '../services/vertexai';
import { log } from '../utils/logger';

const router = Router();

// Only built-in tools the app actually uses may be forwarded to Vertex AI.
const ALLOWED_TOOLS = new Set(['google_search', 'googleSearch']);

// POST /api/generate — Forward text generation to Vertex AI.
// The model is always chosen server-side (config.vertex.modelText) so clients
// cannot pick arbitrary (or more expensive) models. The response carries a
// `_meta` block (model, fallbackUsed, latencyMs, thinkingLevel) that powers the
// "How the AI thought" panel.
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

    const vertexBody: Record<string, any> = { contents: normalizedContents };
    if (generationConfig) vertexBody.generationConfig = generationConfig;
    if (tools) vertexBody.tools = tools;
    if (systemInstruction) vertexBody.systemInstruction = systemInstruction;

    const hasTools = !!(tools && tools.length);
    const hasImage = normalizedContents.some((c: any) => c.parts?.some((p: any) => p.inlineData));
    log.info('generate', '→ text', { turns: normalizedContents.length, tools: hasTools, image: hasImage });

    const result = await generateText(vertexBody, (primary, status, message) => {
      log.error('generate', `Primary model ${primary} failed (${status}), retrying with fallback`, { error: message });
    });

    if (!result.ok) {
      const status = [400, 403, 429, 504].includes(result.status) ? result.status : 502;
      log.error('generate', `← ${status} in ${result.meta.latencyMs}ms`, {
        model: result.meta.model,
        error: result.data?.error?.message,
      });
      res.status(status).json({
        error: result.data?.error?.message || 'Vertex AI request failed',
      });
      return;
    }

    const text = extractText(result.data);
    log.info('generate', `← 200 in ${result.meta.latencyMs}ms`, {
      model: result.meta.model,
      chars: text.length,
    });
    res.json({ text, ...result.data, _meta: result.meta });
  } catch (err: any) {
    log.error('generate', `Exception: ${err.message}`);
    res.status(502).json({ error: 'Failed to forward request to Vertex AI' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { getAccessToken, getGenerateUrl } from '../services/vertexai';
import { config } from '../config';

const router = Router();

// Call Vertex AI generateContent and return parsed response
async function callVertexAI(
  url: string,
  token: string,
  body: Record<string, any>,
): Promise<{ ok: boolean; status: number; data: any }> {
  const vertexResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await vertexResponse.text();
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    return { ok: false, status: 502, data: { error: { message: 'Vertex AI returned non-JSON: ' + responseText.slice(0, 200) } } };
  }

  return { ok: vertexResponse.ok, status: vertexResponse.status, data };
}

// POST /api/generate — Forward text generation to Vertex AI
router.post('/', async (req: Request, res: Response) => {
  try {
    const { model, contents, generationConfig, tools, systemInstruction } = req.body;

    // Normalize contents: wrap single object in array, default role to "user"
    let normalizedContents = contents;
    if (contents && !Array.isArray(contents)) {
      normalizedContents = [contents];
    }
    if (Array.isArray(normalizedContents)) {
      normalizedContents = normalizedContents.map((c: any) => ({
        role: c.role || 'user',
        ...c,
      }));
    }

    // Build Vertex AI request body
    const vertexBody: Record<string, any> = {
      contents: normalizedContents,
    };
    if (generationConfig) vertexBody.generationConfig = generationConfig;
    if (tools) vertexBody.tools = tools;
    if (systemInstruction) vertexBody.systemInstruction = systemInstruction;

    const token = await getAccessToken();
    const url = getGenerateUrl(model);

    let result = await callVertexAI(url, token, vertexBody);

    // Fallback: if the primary model fails and no explicit model was requested,
    // retry with the fallback model
    if (!result.ok && !model && config.vertex.modelTextFallback) {
      const fallbackUrl = getGenerateUrl(config.vertex.modelTextFallback);
      console.log(`Primary model failed (${result.status}), falling back to ${config.vertex.modelTextFallback}`);
      result = await callVertexAI(fallbackUrl, token, vertexBody);
    }

    if (!result.ok) {
      const status = result.status === 429 ? 429
        : result.status === 400 ? 400
        : result.status === 403 ? 403
        : 502;
      res.status(status).json({
        error: result.data?.error?.message || 'Vertex AI request failed',
        details: result.data?.error,
      });
      return;
    }

    // Add convenience top-level text field
    const text = result.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text, ...result.data });
  } catch (err: any) {
    console.error('Generate error:', err);
    res.status(502).json({ error: `Failed to forward request to Vertex AI: ${err.message || err}` });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { getAccessToken, getGenerateUrl } from '../services/vertexai';

const router = Router();

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

    const vertexResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vertexBody),
    });

    const responseText = await vertexResponse.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Vertex AI returned non-JSON:', responseText.slice(0, 200));
      res.status(502).json({ error: 'Vertex AI returned an invalid response. Check GOOGLE_CLOUD_PROJECT env var.' });
      return;
    }

    if (!vertexResponse.ok) {
      const status = vertexResponse.status === 429 ? 429
        : vertexResponse.status === 400 ? 400
        : vertexResponse.status === 403 ? 403
        : 502;
      res.status(status).json({
        error: data?.error?.message || 'Vertex AI request failed',
        details: data?.error,
      });
      return;
    }

    // Add convenience top-level text field
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text, ...data });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(502).json({ error: 'Failed to forward request to Vertex AI' });
  }
});

export default router;

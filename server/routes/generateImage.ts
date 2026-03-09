import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAccessToken, getImageGenerateUrl } from '../services/vertexai';
import { downloadBuffer, uploadBuffer } from '../services/storage';
import { getFirestore, FieldValue } from '../services/firestore';
import { log } from '../utils/logger';

const router = Router();

// POST / — Generate an image of the user in the artwork's style
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { artworkTitle, artworkArtist, artworkStyle, artworkYear } = req.body;

    if (!artworkTitle || !artworkArtist) {
      res.status(400).json({ error: 'Missing artworkTitle or artworkArtist' });
      return;
    }

    // 1. Retrieve the user's selfie from Cloud Storage
    const selfiePath = `users/${userId}/selfie.jpg`;
    let selfieBuffer: Buffer;
    try {
      selfieBuffer = await downloadBuffer(selfiePath);
    } catch {
      res.status(400).json({ error: 'No selfie found. Please take a selfie first.' });
      return;
    }

    const selfieBase64 = selfieBuffer.toString('base64');

    // 2. Build the prompt
    const prompt = `Generate a creative artistic portrait of the person in this photo, reimagined in the style of "${artworkTitle}" by ${artworkArtist}${artworkYear ? ` (${artworkYear})` : ''}${artworkStyle ? `, ${artworkStyle} style` : ''}. Maintain the person's facial features and likeness while fully applying the artistic style, color palette, brushwork, and composition techniques of the original artwork. Make it look like the person belongs in that artwork.`;

    // 3. Call Gemini with image generation
    log.info('generate-image', `→ Generating portrait for "${artworkTitle}" by ${artworkArtist}`, {
      user: userId.slice(0, 8),
    });
    const startTime = Date.now();
    const token = await getAccessToken();
    const url = getImageGenerateUrl();

    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: selfieBase64,
              },
            },
            { text: prompt },
          ],
        }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
    });

    const responseText = await apiResponse.text();
    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch {
      log.error('generate-image', 'Vertex AI returned non-JSON', { response: responseText.slice(0, 200) });
      res.status(502).json({ error: 'Image generation returned an invalid response. Check GOOGLE_CLOUD_PROJECT env var.' });
      return;
    }

    if (!apiResponse.ok) {
      log.error('generate-image', `← ${apiResponse.status} in ${Date.now() - startTime}ms`, {
        error: result?.error?.message || responseText.slice(0, 200),
      });
      res.status(502).json({ error: 'Image generation failed' });
      return;
    }

    // 4. Extract generated image from response
    const generatedPart = result.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData?.data
    );

    if (!generatedPart?.inlineData?.data) {
      log.error('generate-image', 'No image in response', { finishReason: result.candidates?.[0]?.finishReason });
      res.status(502).json({ error: 'No image was generated. The model may have declined the request.' });
      return;
    }

    const imageBase64 = generatedPart.inlineData.data;
    const imageMimeType = generatedPart.inlineData.mimeType || 'image/png';
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // 5. Save to Cloud Storage
    const imageId = uuidv4();
    const destination = `users/${userId}/generated/${imageId}.png`;
    await uploadBuffer(imageBuffer, destination, imageMimeType);

    // 6. Save record to Firestore
    const db = getFirestore();
    await db.collection('users').doc(userId)
      .collection('generatedImages').doc(imageId)
      .set({
        artworkTitle,
        artworkArtist,
        imageUrl: destination,
        prompt,
        createdAt: FieldValue.serverTimestamp(),
      });

    // 7. Return proxy URL (signed URLs require service-account credentials)
    const proxyUrl = `/api/images/${destination}`;

    log.info('generate-image', `← 200 in ${Date.now() - startTime}ms`, {
      imageId,
      sizeKb: Math.round(imageBuffer.length / 1024),
    });

    res.json({
      imageId,
      imageUrl: proxyUrl,
      prompt,
    });
  } catch (err: any) {
    log.error('generate-image', `Exception: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET / — List all generated images for the gallery
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const db = getFirestore();

    const snapshot = await db.collection('users').doc(userId)
      .collection('generatedImages')
      .orderBy('createdAt', 'desc')
      .get();

    const images = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        artworkTitle: data.artworkTitle || '',
        artworkArtist: data.artworkArtist || '',
        imageUrl: data.imageUrl ? `/api/images/${data.imageUrl}` : '',
        prompt: data.prompt || '',
        createdAt: data.createdAt?.toMillis?.() || 0,
      };
    });

    res.json({ images });
  } catch (err: any) {
    console.error('Gallery fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

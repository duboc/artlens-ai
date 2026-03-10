import { Router, Request, Response } from 'express';
import { getAccessToken, getGenerateUrl, getTtsStreamUrl } from '../services/vertexai';
import { config } from '../config';
import { log } from '../utils/logger';

const router = Router();

const PERSONA_DESCRIPTIONS: Record<string, string> = {
  guide: 'You are warm, friendly, and approachable — like a knowledgeable friend showing someone around. You use conversational language, relatable comparisons, and genuine enthusiasm.',
  academic: 'You are scholarly, precise, and authoritative — a respected art historian sharing expertise. You provide historical context and use proper art terminology, but remain engaging.',
  blogger: 'You are energetic, casual, and entertaining — you make art feel exciting and relevant. You use contemporary language, pop culture references, and dramatic storytelling.',
};

const VOICE_MAP: Record<string, string> = {
  guide: 'Zephyr',
  academic: 'Kore',
  blogger: 'Puck',
};

const TONE_MAP: Record<string, string> = {
  guide: 'warm and friendly',
  academic: 'measured and authoritative',
  blogger: 'energetic and enthusiastic',
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
};

// Stage 1: Generate narration script with Flash Lite
async function generateScript(
  artData: any,
  persona: string,
  language: string,
  userName: string,
  token: string,
): Promise<string> {
  const personaDesc = PERSONA_DESCRIPTIONS[persona] || PERSONA_DESCRIPTIONS.guide;
  const langName = LANGUAGE_NAMES[language] || 'English';

  const systemInstruction = {
    parts: [{
      text: `You are the museum guide for the Google Cloud AI Leadership Academy visit to the Museu Nacional d'Art de Catalunya (MNAC).

Personality: ${personaDesc}

Write a short narration script (2-3 sentences, about 15-20 seconds when read aloud) for a visitor who just scanned an artwork. The script must:
1. Greet the visitor by their first name
2. Identify the artwork naturally (title, artist)
3. Share one compelling detail — a story, hidden meaning, technique, or surprising fact
4. End with a brief invitation to continue the conversation

Rules:
- Write entirely in ${langName}
- Write as natural spoken text — no markdown, bullets, emojis, or formatting
- Match the personality exactly
- Keep it tight — this is a 15-20 second intro, not a lecture`,
    }],
  };

  const contents = [{
    role: 'user',
    parts: [{
      text: `Visitor name: ${userName}

Artwork:
- Title: ${artData.title}
- Artist: ${artData.artist}
- Year: ${artData.year || 'Unknown'}
- Style: ${artData.style || ''}
- Description: ${artData.description || ''}
- Fun fact: ${artData.funFact || ''}

Generate the narration script.`,
    }],
  }];

  const url = getGenerateUrl();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contents, systemInstruction }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Script generation failed (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Empty script generated');
  return text.trim();
}

// Stage 2: Synthesize script to audio with Flash TTS (streaming SSE)
async function synthesizeAudio(
  script: string,
  persona: string,
  token: string,
): Promise<Buffer> {
  const voice = VOICE_MAP[persona] || 'Zephyr';
  const tone = TONE_MAP[persona] || 'warm and friendly';

  const url = getTtsStreamUrl();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: `Read the following text aloud in a ${tone} tone:\n\n${script}` }],
      }],
      generationConfig: {
        temperature: 1,
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`TTS synthesis failed (${response.status}): ${err.slice(0, 200)}`);
  }

  // Parse SSE stream and collect PCM chunks
  const pcmChunks: Buffer[] = [];
  let sampleRate = 24000;
  let bitsPerSample = 16;

  const text = await response.text();
  const events = text.split('\n\n').filter(e => e.startsWith('data: '));

  for (const event of events) {
    const jsonStr = event.replace('data: ', '');
    try {
      const chunk = JSON.parse(jsonStr);
      const inlineData = chunk?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineData?.data) continue;

      // Parse sample rate from first chunk
      if (pcmChunks.length === 0 && inlineData.mimeType) {
        const rateMatch = inlineData.mimeType.match(/rate=(\d+)/);
        if (rateMatch) sampleRate = parseInt(rateMatch[1], 10);
        const bitsMatch = inlineData.mimeType.match(/audio\/L(\d+)/);
        if (bitsMatch) bitsPerSample = parseInt(bitsMatch[1], 10);
      }

      pcmChunks.push(Buffer.from(inlineData.data, 'base64'));
    } catch {
      // Skip malformed chunks
    }
  }

  if (pcmChunks.length === 0) throw new Error('No audio data from TTS');

  const pcmData = Buffer.concat(pcmChunks);
  const wavHeader = createWavHeader(pcmData.length, { numChannels: 1, sampleRate, bitsPerSample });
  return Buffer.concat([wavHeader, pcmData]);
}

function createWavHeader(dataLength: number, opts: { numChannels: number; sampleRate: number; bitsPerSample: number }) {
  const { numChannels, sampleRate, bitsPerSample } = opts;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const buf = Buffer.alloc(44);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLength, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLength, 40);
  return buf;
}

// POST /api/tts/narrate — Generate narration script and audio
router.post('/narrate', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { artData, persona, language, userName } = req.body;

    if (!artData?.title || !artData?.artist) {
      res.status(400).json({ error: 'Missing artData (title, artist required)' });
      return;
    }

    const validPersona = ['guide', 'academic', 'blogger'].includes(persona) ? persona : 'guide';
    const validLang = ['en', 'pt', 'es'].includes(language) ? language : 'en';
    const name = userName || 'visitor';

    log.info('tts', `→ Generating narration for "${artData.title}" (${validPersona}/${validLang})`, {
      user: userId.slice(0, 8),
    });

    const startTime = Date.now();
    const token = await getAccessToken();

    // Stage 1: Generate script
    const script = await generateScript(artData, validPersona, validLang, name, token);
    const scriptTime = Date.now() - startTime;
    log.info('tts', `  Script generated in ${scriptTime}ms (${script.length} chars)`);

    // Stage 2: Synthesize audio
    const wavBuffer = await synthesizeAudio(script, validPersona, token);
    const totalTime = Date.now() - startTime;
    const durationSecs = ((wavBuffer.length - 44) / (24000 * 2)).toFixed(1);

    log.info('tts', `← 200 in ${totalTime}ms (${durationSecs}s audio, ${Math.round(wavBuffer.length / 1024)}KB)`, {
      user: userId.slice(0, 8),
    });

    res.json({
      script,
      audio: wavBuffer.toString('base64'),
      mimeType: 'audio/wav',
      durationSecs: parseFloat(durationSecs),
    });
  } catch (err: any) {
    log.error('tts', `Exception: ${err.message}`);
    res.status(502).json({ error: 'Narration generation failed' });
  }
});

export default router;

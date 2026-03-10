// Gemini TTS experiment using ADC (no API key)
// Run: npx tsx experiments/tts-test.ts

import { GoogleGenAI } from '@google/genai';
import { writeFileSync } from 'fs';

async function main() {
  const project = process.env.GOOGLE_CLOUD_PROJECT || 'riojucu';

  const ai = new GoogleGenAI({
    vertexai: true,
    project,
    location: 'us-central1',
    googleAuthOptions: {
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    },
  });

  const model = 'gemini-2.5-flash-tts';

  const config = {
    temperature: 1,
    responseModalities: ['audio'] as const,
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Zephyr',
        },
      },
    },
  };

  const text = process.argv[2] || `Welcome to the Museu Nacional d'Art de Catalunya! I'm your personal art guide. Let me tell you about the incredible collection we have here today.`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: `Read aloud in a warm and friendly tone:\n${text}` }],
    },
  ];

  console.log(`Model: ${model} | Project: ${project}`);
  console.log(`Text: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`);
  console.log('Generating speech...');

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });

  // Collect all PCM chunks, then write a single WAV
  const pcmChunks: Buffer[] = [];
  let sampleRate = 24000;
  let bitsPerSample = 16;
  let chunkCount = 0;

  for await (const chunk of response) {
    const inlineData = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) continue;

    // Parse sample rate from mime type (e.g. "audio/L16;rate=24000")
    if (chunkCount === 0 && inlineData.mimeType) {
      const rateMatch = inlineData.mimeType.match(/rate=(\d+)/);
      if (rateMatch) sampleRate = parseInt(rateMatch[1], 10);
      const bitsMatch = inlineData.mimeType.match(/audio\/L(\d+)/);
      if (bitsMatch) bitsPerSample = parseInt(bitsMatch[1], 10);
    }

    pcmChunks.push(Buffer.from(inlineData.data, 'base64'));
    chunkCount++;
  }

  if (pcmChunks.length === 0) {
    console.error('No audio data received');
    process.exit(1);
  }

  const pcmData = Buffer.concat(pcmChunks);
  const wavHeader = createWavHeader(pcmData.length, { numChannels: 1, sampleRate, bitsPerSample });
  const wavFile = Buffer.concat([wavHeader, pcmData]);

  const outputPath = 'experiments/tts_output.wav';
  writeFileSync(outputPath, wavFile);

  const durationSecs = (pcmData.length / (sampleRate * (bitsPerSample / 8))).toFixed(1);
  console.log(`Done! ${chunkCount} chunks → ${outputPath} (${durationSecs}s, ${(wavFile.length / 1024).toFixed(0)}KB)`);
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

main().catch(console.error);

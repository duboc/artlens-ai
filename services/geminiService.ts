import { IdentifyResponse, GroundingSource, ArtData, DeepArtData, Language, Annotation, AiTrace } from '../types';
import { apiPost } from './apiClient';
import { getMuseum } from '../museums';

// Helper to clean and parse JSON from model response
const parseJSON = (text: string): any => {
  try {
    if (!text) return null;

    // 1. Remove markdown code blocks if present
    let cleanText = text.replace(/```json\n?|```/g, '').trim();

    // 2. Handle potential leading/trailing non-json text
    const firstBrace = cleanText.indexOf('{');
    const firstBracket = cleanText.indexOf('[');

    let start = -1;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        start = firstBrace;
    } else if (firstBracket !== -1) {
        start = firstBracket;
    }

    if (start !== -1) {
       const lastBrace = cleanText.lastIndexOf('}');
       const lastBracket = cleanText.lastIndexOf(']');
       const end = Math.max(lastBrace, lastBracket);

       if (end !== -1) {
           cleanText = cleanText.substring(start, end + 1);
       }
    }

    // 3. Remove trailing commas (common LLM JSON error)
    cleanText = cleanText.replace(/,\s*([\]}])/g, '$1');

    return JSON.parse(cleanText);
  } catch (e) {
    console.error("JSON Parse Error:", e);
    return null;
  }
};

const extractSources = (response: any): GroundingSource[] => {
  const sources: GroundingSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        sources.push({
          title: chunk.web.title || 'Web Source',
          uri: chunk.web.uri
        });
      }
    });
  }
  return sources;
};

/** Collect what the "How the AI thought" panel shows from the search-grounded call. */
export const buildAiTrace = (
  response: any,
  parsed: any,
  latencyMs: number,
  museumName: string | null,
): AiTrace => {
  const meta = response?._meta || {};
  const grounding = response?.candidates?.[0]?.groundingMetadata || {};
  const confidence = typeof parsed?.confidence === 'string' ? parsed.confidence.toLowerCase() : null;
  return {
    model: meta.model || response?.modelVersion || 'unknown',
    fallbackUsed: !!meta.fallbackUsed,
    latencyMs,
    thinkingLevel: meta.thinkingLevel || null,
    confidence: confidence === 'high' || confidence === 'medium' || confidence === 'low' ? confidence : null,
    evidence: typeof parsed?.evidence === 'string' ? parsed.evidence : '',
    searchQueries: Array.isArray(grounding.webSearchQueries) ? grounding.webSearchQueries.slice(0, 8) : [],
    museumContext: museumName && museumName !== 'Museum' ? museumName : null,
  };
};

const getLanguageName = (lang: Language): string => {
  switch(lang) {
    case 'pt': return 'Portuguese';
    case 'es': return 'Spanish';
    default: return 'English';
  }
};

export const identifyArtwork = async (base64Image: string, language: Language): Promise<IdentifyResponse> => {
  const langName = getLanguageName(language);
  const museum = getMuseum();
  const museumHint = museum.identifyHint;
  try {
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image
      }
    };

    const searchPrompt = `
      Identify the piece of art in this image.
      Return a JSON object with these exact keys: "title", "artist", "year", "country", "funFact", "confidence", "evidence".

      Example:
      {
        "title": "Starry Night",
        "artist": "Vincent van Gogh",
        "year": "1889",
        "country": "Netherlands",
        "funFact": "Painted from his asylum window.",
        "confidence": "high",
        "evidence": "The swirling night sky, cypress and village match the 1889 painting; museum sources confirm it."
      }

      "country": The artist's nationality.
      "funFact": An interesting trivia point, ONE sentence of at most 25 words.
      "confidence": "high", "medium" or "low": how sure you are that this is the right artwork.
      "evidence": One short sentence on the visual clues and sources that led to your answer.

      ${museumHint ? `CONTEXT: ${museumHint}\n\n` : ''}IMPORTANT:
      - Use Google Search to verify details.
      - Provide all string values in ${langName}.
      - The JSON keys must remain in English.
      - Do not include markdown formatting.
    `;

    const visualPrompt = `
      Analyze the visual style of the artwork in this image.
      Return a JSON object with keys: "style", "description", "annotations".

      Structure:
      {
        "style": "Art movement/technique",
        "description": "Concise visual description (max 2 sentences).",
        "annotations": [
          {
            "label": "Short name of a notable detail (2-4 words)",
            "description": "Why this detail is significant."
          }
        ]
      }

      Details:
      - Identify 3-4 distinct, interesting details a visitor should notice.

      IMPORTANT:
      - Provide string values in ${langName}.
      - JSON keys must remain in English.
    `;

    // Execute Parallel Calls via proxy
    const startedAt = performance.now();
    const [searchResponse, visualResponse] = await Promise.all([
      // 1. Search-grounded identification (tool enabled, text output)
      apiPost('/api/generate', {
        contents: [{ role: 'user', parts: [imagePart, { text: searchPrompt }] }],
        tools: [{ google_search: {} }],
      }),
      // 2. Visual analysis (no tools, JSON output)
      apiPost('/api/generate', {
        contents: [{ role: 'user', parts: [imagePart, { text: visualPrompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    ]);

    // Parse Results — proxy adds top-level `text` field
    const searchData = parseJSON(searchResponse.text || "{}");
    const visualData = parseJSON(visualResponse.text || "{}");

    // Process Annotations with IDs and validation
    const annotations: Annotation[] = (visualData?.annotations || [])
      .filter((ann: any) => ann && typeof ann.label === 'string' && ann.label.trim())
      .slice(0, 4)
      .map((ann: any, index: number) => ({
        id: `ann-${index}-${Date.now()}`,
        label: ann.label.trim(),
        description: ann.description || '',
      }));

    // Merge Sources from both responses
    const sources = [
      ...extractSources(searchResponse),
      ...extractSources(visualResponse)
    ];

    const uniqueSources = Array.from(new Map(sources.map(s => [s.uri, s])).values());

    return {
      title: searchData?.title || "Unknown Artwork",
      artist: searchData?.artist || "Unknown Artist",
      year: searchData?.year || "Unknown Date",
      country: searchData?.country || "Unknown Origin",
      funFact: searchData?.funFact || "No trivia available.",

      style: visualData?.style || "Style Unknown",
      description: visualData?.description || "Analysis available.",

      sources: uniqueSources,
      annotations: annotations,
      aiTrace: buildAiTrace(searchResponse, searchData, Math.round(performance.now() - startedAt), museum.shortName),
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Unable to analyze artwork. Please check your connection and try again.");
  }
};

export const getDeepArtworkAnalysis = async (base64Image: string, currentData: ArtData, language: Language): Promise<DeepArtData> => {
  const langName = getLanguageName(language);
  try {
    const prompt = `
      Act as a world-class art historian. Provide a deep analysis of "${currentData.title}" by ${currentData.artist}.

      Return a JSON object with keys: "historicalContext", "technicalAnalysis", "symbolism", "curiosities".
      The visitor reads this on a phone while standing in front of the work: be brief and concrete.

      "historicalContext": ONE short paragraph, at most 2 sentences (about 40 words).
      "technicalAnalysis": ONE short paragraph, at most 2 sentences (about 40 words).
      "symbolism": ONE short paragraph, at most 2 sentences (about 40 words).
      "curiosities": An array of exactly 3 unique, lesser-known facts about this work, each ONE sentence of at most 18 words.
      No line breaks, no lists or markdown inside the values.

      IMPORTANT: Provide content in ${langName}. JSON keys in English.
    `;

    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image
      }
    };

    const response = await apiPost('/api/generate', {
      contents: [{ role: 'user', parts: [imagePart, { text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    const data = parseJSON(response.text || "{}");

    return {
      historicalContext: data?.historicalContext || "Context unavailable.",
      technicalAnalysis: data?.technicalAnalysis || "Technical analysis unavailable.",
      symbolism: data?.symbolism || "Symbolism unavailable.",
      curiosities: data?.curiosities || []
    };

  } catch (error) {
    console.error("Deep Analysis Error:", error);
    throw new Error("Failed to perform deep analysis.");
  }
};

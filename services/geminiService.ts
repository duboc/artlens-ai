import { IdentifyResponse, GroundingSource, ArtData, DeepArtData, Language, Annotation } from '../types';
import { apiPost } from './apiClient';

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

const getLanguageName = (lang: Language): string => {
  switch(lang) {
    case 'pt': return 'Portuguese';
    case 'es': return 'Spanish';
    default: return 'English';
  }
};

export const identifyArtwork = async (base64Image: string, language: Language): Promise<IdentifyResponse> => {
  const langName = getLanguageName(language);
  try {
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image
      }
    };

    const searchPrompt = `
      Identify the piece of art in this image.
      Return a JSON object with these exact keys: "title", "artist", "year", "country", "funFact".

      Example:
      {
        "title": "Starry Night",
        "artist": "Vincent van Gogh",
        "year": "1889",
        "country": "Netherlands",
        "funFact": "Painted from his asylum window."
      }

      "country": The artist's nationality.
      "funFact": An interesting trivia point.

      IMPORTANT:
      - Use Google Search to verify details.
      - Provide all string values in ${langName}.
      - The JSON keys must remain in English.
      - Do not include markdown formatting.
    `;

    const visualPrompt = `
      Analyze the visual style and topography of this image.
      Return a JSON object with keys: "style", "description", "annotations".

      Structure:
      {
        "style": "Art movement/technique",
        "description": "Concise visual description (max 2 sentences).",
        "annotations": [
          {
            "label": "Region Name",
            "description": "Significance of this region.",
            "box_2d": [ymin, xmin, ymax, xmax]
          }
        ]
      }

      Details:
      - "box_2d": Array of 4 integers [ymin, xmin, ymax, xmax] on a 0-1000 scale.
      - Identify 4-5 distinct, interesting regions.

      IMPORTANT:
      - Provide string values in ${langName}.
      - JSON keys must remain in English.
    `;

    // Execute Parallel Calls via proxy
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
      .filter((ann: any) => ann.box_2d && Array.isArray(ann.box_2d) && ann.box_2d.length === 4)
      .map((ann: any, index: number) => ({
        id: `ann-${index}-${Date.now()}`,
        label: ann.label || 'Details',
        description: ann.description || '',
        box_2d: ann.box_2d
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
      annotations: annotations
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

      "curiosities": An array of 3 unique, lesser-known facts or specific details about this work.

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

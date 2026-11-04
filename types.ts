
export interface GroundingSource {
  title?: string;
  uri?: string;
}

export interface DeepArtData {
  historicalContext: string;
  technicalAnalysis: string;
  symbolism: string;
  curiosities: string[];
}

export interface Annotation {
  id: string;
  label: string;
  description: string;
}

export interface ArtData {
  title: string;
  artist: string;
  year: string;
  country: string;
  style: string;
  description: string;
  funFact: string;
}

/** What the "How the AI thought" panel shows for one identification. */
export interface AiTrace {
  model: string;
  fallbackUsed: boolean;
  /** Wall-clock time the visitor waited for the identification, in ms. */
  latencyMs: number | null;
  thinkingLevel: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  /** One sentence from the model on the clues it used. */
  evidence: string;
  /** Google Search queries the model ran to verify the answer. */
  searchQueries: string[];
  /** Museum profile used as context, e.g. "Museo Reina Sofía". */
  museumContext: string | null;
}

export interface IdentifyResponse extends ArtData {
  sources: GroundingSource[];
  deepAnalysis?: DeepArtData;
  annotations?: Annotation[];
  aiTrace?: AiTrace;
}

/** Points earned by saving a scan (returned by POST /api/scans). */
export interface ScanAwards {
  points: number;
  newArtwork: boolean;
  missions: { id: string; points: number }[];
  totalPoints: number;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  imageUrl: string;
  data: IdentifyResponse;
}

export type Language = 'en' | 'pt' | 'es';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isAudioTranscription?: boolean;
}

export type Persona = 'guide' | 'academic' | 'blogger';

export interface UserContext {
  name: string;
  email: string;
  persona: Persona;
  selfieUrl?: string;
}

export interface GeneratedImage {
  id: string;
  scanId: string;
  artworkTitle: string;
  artworkArtist: string;
  imageUrl: string;
  prompt: string;
  createdAt: number;
}

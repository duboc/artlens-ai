
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
  box_2d: [number, number, number, number]; // ymin, xmin, ymax, xmax (0-1000 scale)
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

export interface IdentifyResponse extends ArtData {
  sources: GroundingSource[];
  deepAnalysis?: DeepArtData;
  annotations?: Annotation[];
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
  persona: Persona;
}

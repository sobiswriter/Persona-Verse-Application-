
export interface Memory {
  id: string;
  personaId: string; // To which persona this memory belongs
  title: string;
  description: string;
  date?: string; // Optional: ISO string date of the memory's occurrence
  impact: 'low' | 'medium' | 'high';
  sentiment: 'positive' | 'negative' | 'neutral';
  createdAt: string; // ISO string date of when the memory entry was created
}

export interface Persona {
  id: string;
  name: string;
  biography: string;
  characterDescription: string;
  voiceSampleTranscript: string; // Transcript of sound recordings
  writings: string; // Will store concatenated text extracted from PDFs
  writingFileNames?: string[]; // Optional: names of the uploaded PDF files
  imageUrl?: string; // Optional image URL
  createdAt: string;
  chatHistory?: ChatMessage[]; // Optional: stores recent chat messages
  memories?: Memory[]; // Optional: stores implanted memories
}

export interface ChatMessage {
  id:string;
  sender: 'user' | 'persona';
  text: string;
  timestamp: string;
}

export interface PlaygroundMessage {
  id: string;
  speakerPersona: {
    id: string;
    name: string;
    imageUrl?: string;
  };
  text: string;
  timestamp: string;
  isError?: boolean; // Optional flag for error messages
  isSystem?: boolean; // Optional flag for system messages like "thinking..."
}

// Updated AppView to include all states used in App.tsx for mainContentView
export type AppView = 'welcome' | 'form' | 'chat' | 'test' | 'playground' | 'settings' | 'memories';

export interface GroundingChunkWeb {
  uri?: string; 
  title?: string; 
}

export interface GroundingChunk {
  web?: GroundingChunkWeb;
  retrievedContext?: {
    text?: string; 
  };
}

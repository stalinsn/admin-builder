import { CvData } from './cv';

export interface TranslationResult {
  translated: CvData;
  tokensUsed: number;
}

export interface TranslationStatus {
  tokensUsed: number | null;
  elapsedTime: number | null;
  payloadSize: number | null;
  charCount: number | null;
  model: string;
}

export interface TranslationError {
  message: string;
  canRetry: boolean;
  canUseFallback: boolean;
}

export type TranslationMode = 'ai' | 'mock';

export interface TranslationCache {
  [key: string]: CvData;
}

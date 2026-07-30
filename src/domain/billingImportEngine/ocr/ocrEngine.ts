import type { BillingExtractionProgress } from '../billingOcrConfig';

export interface OcrWordResult {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number } | null;
}

export interface OcrPageResult {
  text: string;
  words: OcrWordResult[];
  meanConfidence: number;
  durationMs: number;
}

export interface OcrEngineProgress {
  status: string;
  progress: number;
}

export interface OcrEngine {
  initialize(onProgress?: (progress: OcrEngineProgress) => void): Promise<void>;
  recognize(
    image: HTMLCanvasElement,
    options?: { signal?: AbortSignal; timeoutMs?: number },
  ): Promise<OcrPageResult>;
  terminate(): Promise<void>;
  isInitialized(): boolean;
}

export type OcrEngineFactory = () => OcrEngine;

export function mapEngineProgressToExtractionProgress(
  engineProgress: OcrEngineProgress,
  base: Partial<BillingExtractionProgress>,
): BillingExtractionProgress {
  if (/loading language/i.test(engineProgress.status)) {
    return { phase: 'loading_language', progress: engineProgress.progress, message: 'Sprachdaten werden geladen…', ...base };
  }
  if (/initializing/i.test(engineProgress.status)) {
    return { phase: 'initializing', progress: engineProgress.progress, message: 'OCR wird initialisiert…', ...base };
  }
  if (/recognizing/i.test(engineProgress.status)) {
    return { phase: 'recognizing_page', progress: engineProgress.progress, message: 'Texterkennung läuft…', ...base };
  }
  return { phase: 'initializing', progress: engineProgress.progress, message: engineProgress.status, ...base };
}

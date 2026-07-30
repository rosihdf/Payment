import type { OcrEngine, OcrEngineFactory } from './ocr/ocrEngine';
import { createTesseractOcrEngine } from './ocr/tesseractOcrEngine';

let sharedEngine: OcrEngine | null = null;
let activeJobs = 0;

export class BillingOcrSessionManager {
  private readonly engineFactory: OcrEngineFactory;

  constructor(engineFactory: OcrEngineFactory = createTesseractOcrEngine) {
    this.engineFactory = engineFactory;
  }

  async acquireEngine(): Promise<OcrEngine> {
    if (!sharedEngine) {
      sharedEngine = this.engineFactory();
    }
    activeJobs += 1;
    return sharedEngine;
  }

  releaseEngine(): void {
    activeJobs = Math.max(0, activeJobs - 1);
  }

  async dispose(): Promise<void> {
    if (sharedEngine && activeJobs === 0) {
      await sharedEngine.terminate();
      sharedEngine = null;
    }
  }

  async forceDispose(): Promise<void> {
    if (sharedEngine) {
      await sharedEngine.terminate();
      sharedEngine = null;
    }
    activeJobs = 0;
  }
}

export const billingOcrSessionManager = new BillingOcrSessionManager();

export function __resetBillingOcrSessionManagerForTests(): void {
  sharedEngine = null;
  activeJobs = 0;
}

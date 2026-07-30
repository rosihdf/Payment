import { BILLING_OCR_CONFIG } from './billingOcrConfig';
import { resolveBillingOcrAssetPaths, validateBillingOcrAssetPaths } from './billingOcrAssetPaths';

export type BillingOcrAssetAvailabilityStatus =
  | 'unknown'
  | 'checking'
  | 'available'
  | 'partially_available'
  | 'unavailable';

export interface BillingOcrAssetAvailability {
  status: BillingOcrAssetAvailabilityStatus;
  worker: boolean;
  core: boolean;
  languages: Record<string, boolean>;
  checkedAt: string | null;
  message: string;
}

let cachedAvailability: BillingOcrAssetAvailability | null = null;
let checkPromise: Promise<BillingOcrAssetAvailability> | null = null;

async function probeAsset(url: string, method: 'HEAD' | 'GET' = 'HEAD'): Promise<boolean> {
  if (typeof fetch !== 'function') {
    return true;
  }

  try {
    const response = await fetch(url, { method, cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkBillingOcrAssetsAvailable(
  force = false,
): Promise<BillingOcrAssetAvailability> {
  if (!force && cachedAvailability?.status === 'available') {
    return cachedAvailability;
  }
  if (!force && checkPromise) {
    return checkPromise;
  }

  checkPromise = (async () => {
    const paths = resolveBillingOcrAssetPaths();
    validateBillingOcrAssetPaths(paths);

    const languageCodes = BILLING_OCR_CONFIG.languages.split('+').filter(Boolean);
    const languageChecks = await Promise.all(
      languageCodes.map(async (language) => {
        const url = `${paths.langPath.replace(/\/$/, '')}/${language}.traineddata.gz`;
        return [language, await probeAsset(url)] as const;
      }),
    );

    const worker = await probeAsset(paths.workerPath);
    const core = await probeAsset(`${paths.corePath.replace(/\/$/, '')}/tesseract-core-lstm.wasm.js`);
    const languages = Object.fromEntries(languageChecks);
    const availableLanguages = Object.values(languages).filter(Boolean).length;

    let status: BillingOcrAssetAvailabilityStatus = 'unavailable';
    if (worker && core && availableLanguages === languageCodes.length) {
      status = 'available';
    } else if (worker || core || availableLanguages > 0) {
      status = 'partially_available';
    }

    cachedAvailability = {
      status,
      worker,
      core,
      languages,
      checkedAt: new Date().toISOString(),
      message:
        status === 'available'
          ? 'Lokale OCR-Assets sind verfügbar.'
          : 'Lokale OCR-Assets sind nicht vollständig verfügbar.',
    };
    return cachedAvailability;
  })();

  try {
    return await checkPromise;
  } finally {
    checkPromise = null;
  }
}

export function resetBillingOcrAssetAvailabilityCache(): void {
  cachedAvailability = null;
  checkPromise = null;
}

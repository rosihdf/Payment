const BLOCKED_OCR_HOSTS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'raw.githubusercontent.com',
  'tessdata.projectnaptha.com',
];

export interface BillingOcrAssetPaths {
  workerPath: string;
  corePath: string;
  langPath: string;
}

function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl) {
    return '/';
  }
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function joinAssetPath(baseUrl: string, segment: string): string {
  const base = normalizeBaseUrl(baseUrl);
  const cleanedSegment = segment.replace(/^\/+/, '');
  if (typeof window !== 'undefined' && !/^https?:\/\//i.test(base)) {
    return new URL(cleanedSegment, `${window.location.origin}${base}`).href;
  }
  return `${base}${cleanedSegment}`.replace(/\/{2,}/g, '/');
}

export function resolveBillingOcrAssetPaths(baseUrl = import.meta.env.BASE_URL): BillingOcrAssetPaths {
  return {
    workerPath: joinAssetPath(baseUrl, 'ocr/worker/worker.min.js'),
    corePath: joinAssetPath(baseUrl, 'ocr/core/'),
    langPath: joinAssetPath(baseUrl, 'ocr/lang/'),
  };
}

export function assertSameOriginOcrAssetUrl(url: string, baseUrl = import.meta.env.BASE_URL): void {
  if (/^https?:\/\//i.test(url)) {
    if (typeof window !== 'undefined') {
      const parsed = new URL(url);
      if (parsed.origin !== window.location.origin) {
        throw new Error('BILLING_OCR_ASSET_ORIGIN_INVALID');
      }
    }
    return;
  }

  if (url.startsWith('//')) {
    throw new Error('BILLING_OCR_ASSET_ORIGIN_INVALID');
  }

  for (const host of BLOCKED_OCR_HOSTS) {
    if (url.includes(host)) {
      throw new Error('BILLING_OCR_ASSET_ORIGIN_INVALID');
    }
  }

  if (!url.startsWith('/') && !url.startsWith(normalizeBaseUrl(baseUrl))) {
    throw new Error('BILLING_OCR_ASSET_ORIGIN_INVALID');
  }
}

export function validateBillingOcrAssetPaths(paths: BillingOcrAssetPaths): void {
  assertSameOriginOcrAssetUrl(paths.workerPath);
  assertSameOriginOcrAssetUrl(paths.corePath);
  assertSameOriginOcrAssetUrl(paths.langPath);
}

export function getBlockedOcrHosts(): readonly string[] {
  return BLOCKED_OCR_HOSTS;
}

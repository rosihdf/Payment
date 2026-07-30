export const BILLING_FILE_LIMITS = {
  maxFileSizeBytes: 15 * 1024 * 1024,
  maxFilesPerSession: 12,
  maxPagesPerDocument: 40,
  minImageWidthPx: 200,
  minImageHeightPx: 200,
} as const;

export const SUPPORTED_BILLING_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type SupportedBillingMimeType = (typeof SUPPORTED_BILLING_MIME_TYPES)[number];

export interface BillingFileValidationResult {
  ok: boolean;
  mimeType: string;
  extension: string;
  fileSizeBytes: number;
  errors: string[];
  warnings: string[];
}

function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : '';
}

const EXTENSION_MIME: Record<string, SupportedBillingMimeType> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function validateBillingFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
): BillingFileValidationResult {
  const extension = extensionOf(file.name);
  const mimeType = file.type || EXTENSION_MIME[extension] || '';
  const errors: string[] = [];
  const warnings: string[] = [];

  if (file.size <= 0) {
    errors.push('BILLING_FILE_EMPTY');
  }

  if (file.size > BILLING_FILE_LIMITS.maxFileSizeBytes) {
    errors.push('BILLING_FILE_TOO_LARGE');
  }

  const supported =
    SUPPORTED_BILLING_MIME_TYPES.includes(mimeType as SupportedBillingMimeType) ||
    Boolean(EXTENSION_MIME[extension]);

  if (!supported) {
    errors.push('BILLING_FILE_TYPE_UNSUPPORTED');
  }

  if (/\.heic$|\.heif$/i.test(file.name)) {
    errors.push('BILLING_FILE_TYPE_UNSUPPORTED');
    warnings.push('HEIC/HEIF wird in diesem Browser nicht unterstützt.');
  }

  return {
    ok: errors.length === 0,
    mimeType: mimeType || EXTENSION_MIME[extension] || '',
    extension,
    fileSizeBytes: file.size,
    errors,
    warnings,
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function sanitizePdfFilename(filename: string): string {
  return filename
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '-')
    .trim();
}

export function buildPreviewPdfFilename(offerNumber: string): string {
  return sanitizePdfFilename(`BestPay-Angebot_VORSCHAU_${offerNumber}.pdf`);
}

export function buildFinalPdfFilename(offerNumber: string, version: number): string {
  return sanitizePdfFilename(`BestPay-Angebot_${offerNumber}_V${version}.pdf`);
}

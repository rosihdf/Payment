import { BILLING_OCR_CONFIG } from './billingOcrConfig';

export async function loadPdfDocument(content: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  return pdfjs.getDocument({ data: content }).promise;
}

export function resolvePdfRenderScale(pageWidth: number, pageHeight: number): number {
  const longestEdge = Math.max(pageWidth, pageHeight);
  if (longestEdge <= 800) {
    return BILLING_OCR_CONFIG.maxPdfRenderScale;
  }
  if (longestEdge >= 1800) {
    return BILLING_OCR_CONFIG.minPdfRenderScale;
  }
  return BILLING_OCR_CONFIG.pdfRenderScale;
}

export async function renderPdfPageToCanvas(
  pdf: Awaited<ReturnType<typeof loadPdfDocument>>,
  pageNumber: number,
  scale?: number,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number; rotation: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const renderScale = scale ?? resolvePdfRenderScale(viewport.width, viewport.height);
  const scaledViewport = page.getViewport({ scale: renderScale, rotation: viewport.rotation });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(scaledViewport.width);
  canvas.height = Math.floor(scaledViewport.height);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas-Kontext nicht verfügbar');
  }

  await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
  return {
    canvas,
    width: scaledViewport.width,
    height: scaledViewport.height,
    rotation: viewport.rotation,
  };
}

export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

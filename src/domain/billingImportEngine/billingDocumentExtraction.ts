import { BILLING_OCR_CONFIG, type BillingExtractionProgress } from './billingOcrConfig';
import { assessEmbeddedTextQuality } from './billingPdfTextQuality';
import type {
  BillingDocumentExtractionRequest,
  BillingDocumentExtractionResult,
  BillingExtractedPage,
} from './providers/billingDocumentExtractionProvider';
import type { BillingProviderRegistry } from './billingProviderRegistry';

function mergePageText(page: BillingExtractedPage): BillingExtractedPage {
  const text = page.textBlocks.map((block) => block.text).join('\n').replace(/\s+/g, ' ').trim();
  return { ...page, text: text || page.text };
}

async function extractPdfWithMixedOcr(
  request: BillingDocumentExtractionRequest,
  registry: BillingProviderRegistry,
): Promise<BillingDocumentExtractionResult> {
  const [{ loadPdfDocument, releaseCanvas, renderPdfPageToCanvas }, { extractPdfPageEmbeddedText }, { ocrPdfPageCanvas }] =
    await Promise.all([
      import('./billingPdfPageRenderer'),
      import('./providers/pdfTextExtractionProvider'),
      import('./providers/browserOcrExtractionProvider'),
    ]);

  const ocrProvider = await registry.getOcrProvider();
  const pdfTextProvider = await registry.getPdfTextProvider();
  const emit = (progress: BillingExtractionProgress) => request.onProgress?.(progress);

  if (request.signal?.aborted) {
    return {
      ok: false,
      providerId: ocrProvider.providerId,
      providerVersion: ocrProvider.providerVersion,
      pages: [],
      errorCode: 'BILLING_OCR_ABORTED',
      errorMessage: 'Extraktion wurde abgebrochen.',
    };
  }

  try {
    const pdf = await loadPdfDocument(request.content);
    const pages: BillingExtractedPage[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      if (request.signal?.aborted) {
        return {
          ok: false,
          providerId: ocrProvider.providerId,
          providerVersion: ocrProvider.providerVersion,
          pages,
          errorCode: 'BILLING_OCR_ABORTED',
          errorMessage: 'Extraktion wurde abgebrochen.',
        };
      }

      emit({
        phase: 'rendering_page',
        message: `Seite ${pageNumber} von ${pdf.numPages} wird vorbereitet…`,
        documentId: request.documentId,
        pageNumber,
        totalPages: pdf.numPages,
      });

      const embedded = await extractPdfPageEmbeddedText(request.content, pageNumber);
      const quality = assessEmbeddedTextQuality(embedded.text);

      if (quality.sufficient) {
        pages.push({
          pageNumber,
          width: embedded.width,
          height: embedded.height,
          extractionMethod: 'embedded_text',
          text: embedded.text,
          textBlocks: embedded.blocks,
          averageConfidence: 0.9,
          rotationDegrees: request.rotationDegrees ?? 0,
        });
        continue;
      }

      let rendered;
      try {
        rendered = await renderPdfPageToCanvas(pdf, pageNumber);
      } catch {
        pages.push({
          pageNumber,
          width: embedded.width,
          height: embedded.height,
          extractionMethod: 'failed',
          text: embedded.text,
          textBlocks: embedded.blocks,
          averageConfidence: 0,
          rotationDegrees: request.rotationDegrees ?? 0,
          warnings: ['BILLING_PDF_PAGE_RENDER_FAILED'],
        });
        continue;
      }

      const ocrPage = await ocrPdfPageCanvas(
        rendered.canvas,
        request,
        pageNumber,
        pdf.numPages,
        (request.rotationDegrees ?? 0) + rendered.rotation,
      );
      releaseCanvas(rendered.canvas);

      if (embedded.text.trim().length > 0 && ocrPage.text.trim().length > 0) {
        pages.push({
          ...ocrPage,
          extractionMethod: 'mixed',
          text: `${embedded.text}\n${ocrPage.text}`.trim(),
          textBlocks: [...embedded.blocks, ...ocrPage.textBlocks],
          averageConfidence: (quality.score / 100 + ocrPage.averageConfidence) / 2,
        });
      } else {
        pages.push(ocrPage);
      }
    }

    emit({
      phase: 'completed',
      message: 'PDF-Extraktion abgeschlossen.',
      documentId: request.documentId,
      progress: 1,
      totalPages: pdf.numPages,
    });

    const hasText = pages.some((page) => page.text.trim().length > 0);
    return {
      ok: hasText,
      providerId: pages.some((page) => page.extractionMethod === 'ocr' || page.extractionMethod === 'mixed')
        ? ocrProvider.providerId
        : pdfTextProvider.providerId,
      providerVersion: ocrProvider.providerVersion,
      pages: pages.map(mergePageText),
      errorCode: hasText ? undefined : 'BILLING_OCR_NO_TEXT',
      errorMessage: hasText ? undefined : 'Es wurde kein verwertbarer Text erkannt.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF-Extraktion fehlgeschlagen';
    return {
      ok: false,
      providerId: ocrProvider.providerId,
      providerVersion: ocrProvider.providerVersion,
      pages: [],
      errorCode: /password|encrypted/i.test(message)
        ? 'BILLING_PDF_PASSWORD_PROTECTED'
        : 'BILLING_TEXT_EXTRACTION_FAILED',
      errorMessage: message,
    };
  }
}

export async function extractBillingDocument(
  request: BillingDocumentExtractionRequest,
  registry: BillingProviderRegistry,
): Promise<BillingDocumentExtractionResult> {
  const isPdf = request.mimeType === 'application/pdf';
  const isImage = request.mimeType.startsWith('image/');

  if (registry.useDemoProvider && registry.demoProvider) {
    return registry.demoProvider.extractDocument(request);
  }

  if (isPdf) {
    return extractPdfWithMixedOcr(request, registry);
  }

  if (isImage) {
    const ocrProvider = await registry.getOcrProvider();
    return ocrProvider.extractDocument(request);
  }

  return registry.fallbackOcrProvider.extractDocument(request);
}

export function flattenPages(pages: BillingExtractedPage[]) {
  return pages.flatMap((page) =>
    page.textBlocks.map((block, index) => ({
      pageNumber: page.pageNumber,
      text: block.text,
      lineNumber: index,
      confidence: block.confidence,
      bbox: block.bbox ?? null,
    })),
  );
}

export { BILLING_OCR_CONFIG };

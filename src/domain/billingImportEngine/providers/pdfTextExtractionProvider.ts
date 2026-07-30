import type {
  BillingDocumentExtractionProvider,
  BillingDocumentExtractionRequest,
  BillingDocumentExtractionResult,
  BillingExtractedPage,
} from './billingDocumentExtractionProvider';
import { loadPdfDocument } from '../billingPdfPageRenderer';

export class PdfTextExtractionProvider implements BillingDocumentExtractionProvider {
  readonly providerId = 'pdf_text_extraction';
  readonly providerVersion = '1.1.0';
  readonly supportedMimeTypes = ['application/pdf'];

  async extractDocument(
    request: BillingDocumentExtractionRequest,
  ): Promise<BillingDocumentExtractionResult> {
    try {
      const pdf = await loadPdfDocument(request.content);
      const pages: BillingExtractedPage[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        pages.push({
          pageNumber,
          width: viewport.width,
          height: viewport.height,
          extractionMethod: text.length > 0 ? 'embedded_text' : 'failed',
          text,
          textBlocks: text
            ? text.split(/(?<=[.!?])\s+/).map((chunk) => ({ text: chunk, confidence: 0.9 }))
            : [],
          averageConfidence: text.length > 0 ? 0.9 : 0,
          rotationDegrees: request.rotationDegrees ?? 0,
        });
      }

      return {
        ok: pages.some((page) => page.text.length > 0),
        providerId: this.providerId,
        providerVersion: this.providerVersion,
        pages,
        errorCode: pages.some((page) => page.text.length > 0)
          ? undefined
          : 'BILLING_TEXT_EXTRACTION_FAILED',
        errorMessage: pages.some((page) => page.text.length > 0)
          ? undefined
          : 'Kein maschinenlesbarer Text im PDF gefunden.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PDF konnte nicht gelesen werden.';
      const isPasswordProtected = /password|encrypted/i.test(message);
      return {
        ok: false,
        providerId: this.providerId,
        providerVersion: this.providerVersion,
        pages: [],
        errorCode: isPasswordProtected ? 'BILLING_PDF_PASSWORD_PROTECTED' : 'BILLING_TEXT_EXTRACTION_FAILED',
        errorMessage: message,
      };
    }
  }
}

export async function extractPdfPageEmbeddedText(
  content: ArrayBuffer,
  pageNumber: number,
): Promise<{ text: string; width: number; height: number; blocks: BillingExtractedPage['textBlocks'] }> {
  const pdf = await loadPdfDocument(content);
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();
  const text = textContent.items
    .map((item) => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    text,
    width: viewport.width,
    height: viewport.height,
    blocks: text
      ? text.split(/(?<=[.!?])\s+/).map((chunk) => ({ text: chunk, confidence: 0.9 }))
      : [],
  };
}

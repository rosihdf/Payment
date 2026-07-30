import { BILLING_OCR_CONFIG } from './billingOcrConfig';

export interface PdfTextQualityAssessment {
  sufficient: boolean;
  score: number;
  textLength: number;
  readableCharRatio: number;
  keywordHits: number;
  reasons: string[];
}

export function assessEmbeddedTextQuality(text: string): PdfTextQualityAssessment {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const reasons: string[] = [];
  if (normalized.length === 0) {
    return {
      sufficient: false,
      score: 0,
      textLength: 0,
      readableCharRatio: 0,
      keywordHits: 0,
      reasons: ['Kein Text vorhanden'],
    };
  }

  const readableChars = normalized.match(/[A-Za-zÄÖÜäöüß0-9€$.,:%/-]/g)?.length ?? 0;
  const readableCharRatio = readableChars / Math.max(normalized.length, 1);
  const lower = normalized.toLowerCase();
  const keywordHits = BILLING_OCR_CONFIG.billingKeywords.filter((keyword) =>
    lower.includes(keyword),
  ).length;

  if (normalized.length < BILLING_OCR_CONFIG.pdfMinTextLength) {
    reasons.push('Text zu kurz');
  }
  if (readableCharRatio < BILLING_OCR_CONFIG.pdfMinReadableCharRatio) {
    reasons.push('Zu wenig lesbare Zeichen');
  }
  if (keywordHits < BILLING_OCR_CONFIG.pdfMinKeywordHits) {
    reasons.push('Keine Abrechnungsschlüsselwörter erkannt');
  }

  const lengthScore = Math.min(1, normalized.length / 120);
  const ratioScore = readableCharRatio;
  const keywordScore = Math.min(1, keywordHits / 3);
  const score = Math.round((lengthScore * 0.35 + ratioScore * 0.4 + keywordScore * 0.25) * 100);

  const sufficient =
    normalized.length >= BILLING_OCR_CONFIG.pdfMinTextLength &&
    readableCharRatio >= BILLING_OCR_CONFIG.pdfMinReadableCharRatio &&
    keywordHits >= BILLING_OCR_CONFIG.pdfMinKeywordHits;

  return {
    sufficient,
    score,
    textLength: normalized.length,
    readableCharRatio,
    keywordHits,
    reasons,
  };
}

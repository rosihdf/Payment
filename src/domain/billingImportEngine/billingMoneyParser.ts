export interface ParsedMoneyValue {
  amountCents: number;
  currency: string | null;
  isCredit: boolean;
  rawText: string;
}

export interface ParsedPercentValue {
  percentTenthsOfBasisPoint: number;
  rawText: string;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function detectCurrency(text: string): string | null {
  if (/€|EUR/i.test(text)) {
    return 'EUR';
  }
  if (/USD|\$/i.test(text)) {
    return 'USD';
  }
  return null;
}

function parseGermanAmount(raw: string): number | null {
  const cleaned = raw.replace(/[€$A-Za-z]/g, '').trim();
  const negative = /^\(|^-|−|-\s*$/.test(cleaned) || /-\s*$/.test(raw.trim());
  const normalized = cleaned
    .replace(/^\(/, '')
    .replace(/\)$/, '')
    .replace(/^-/, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }

  const cents = Math.round(Math.abs(value) * 100);
  return negative ? -cents : cents;
}

function parseInternationalAmount(raw: string): number | null {
  const cleaned = raw.replace(/[€$A-Za-z]/g, '').trim();
  const negative = /^\(|^-/.test(cleaned);
  const normalized = cleaned
    .replace(/^\(/, '')
    .replace(/\)$/, '')
    .replace(/^-/, '')
    .replace(/,/g, '');

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }

  const cents = Math.round(Math.abs(value) * 100);
  return negative ? -cents : cents;
}

export function parseMoneyText(rawText: string): ParsedMoneyValue | null {
  const text = normalizeWhitespace(rawText);
  if (!text) {
    return null;
  }

  const isCredit =
    /gutschrift|credit note|erstattung|storno|rückerstattung/i.test(text) ||
    /^\(/.test(text.trim()) ||
    /-\s*$/.test(text.trim());

  const currency = detectCurrency(text);

  let amountCents: number | null = null;
  const germanMatch =
    text.match(/\d{1,3}(?:\.\d{3})+,\d{2,3}/) ??
    text.match(/\d+,\d{2,3}(?!\d)(?!\.)/);
  const internationalMatch =
    text.match(/\d{1,3}(?:,\d{3})+\.\d{2}/) ?? text.match(/\d+\.\d{2}(?!\d)/);

  const applySign = (matchedText: string, cents: number | null): number | null => {
    if (cents === null) {
      return null;
    }
    const matchIndex = text.indexOf(matchedText);
    const prefix = matchIndex > 0 ? text.slice(0, matchIndex) : '';
    const negative =
      /[-−]\s*$/.test(prefix) ||
      /^\(/.test(text.trim()) ||
      /-\s*$/.test(text.trim()) ||
      isCredit;
    return negative ? -Math.abs(cents) : cents;
  };

  if (internationalMatch && internationalMatch[0].includes('.')) {
    amountCents = applySign(
      internationalMatch[0],
      parseInternationalAmount(internationalMatch[0]),
    );
  } else if (germanMatch) {
    amountCents = applySign(germanMatch[0], parseGermanAmount(germanMatch[0]));
  } else if (/\d+[,.]\d{2,3}/.test(text)) {
    amountCents = parseGermanAmount(text) ?? parseInternationalAmount(text);
    amountCents = applySign(text, amountCents);
  }

  if (amountCents === null) {
    return null;
  }

  return {
    amountCents: isCredit && amountCents > 0 ? -Math.abs(amountCents) : amountCents,
    currency,
    isCredit: isCredit || amountCents < 0,
    rawText: text,
  };
}

export function parsePercentText(rawText: string): ParsedPercentValue | null {
  const text = normalizeWhitespace(rawText);
  const match = text.match(/(\d+[,.]?\d*)\s*%/);
  if (!match?.[1]) {
    return null;
  }

  const normalized = match[1].replace(',', '.');
  const percent = Number.parseFloat(normalized);
  if (!Number.isFinite(percent)) {
    return null;
  }

  return {
    percentTenthsOfBasisPoint: Math.round(percent * 1000),
    rawText: text,
  };
}

export function parseIntegerText(rawText: string): number | null {
  const cleaned = rawText.replace(/[.\s]/g, '').replace(/[^\d-]/g, '');
  const value = Number.parseInt(cleaned, 10);
  return Number.isFinite(value) ? value : null;
}

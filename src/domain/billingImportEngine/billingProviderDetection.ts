export interface DetectedBillingProvider {
  name: string;
  confidence: number;
}

const PROVIDER_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'SumUp', pattern: /\bSumUp\b/i },
  { name: 'PayPal Zettle', pattern: /\b(Zettle|PayPal\s*Zettle)\b/i },
  { name: 'Adyen', pattern: /\bAdyen\b/i },
  { name: 'Worldline', pattern: /\bWorldline\b/i },
  { name: 'Ingenico', pattern: /\bIngenico\b/i },
  { name: 'TeleCash', pattern: /\bTeleCash\b/i },
  { name: 'VR Payment', pattern: /\bVR\s*Payment\b/i },
  { name: 'Hobex', pattern: /\bHobex\b/i },
  { name: 'CardProcess', pattern: /\bCardProcess\b/i },
  { name: 'Payone', pattern: /\bPayone\b/i },
  { name: 'Concardis', pattern: /\bConcardis\b/i },
  { name: 'Nexi', pattern: /\bNexi\b/i },
  { name: 'Stripe', pattern: /\bStripe\b/i },
  { name: 'Clover', pattern: /\bClover\b/i },
  { name: 'myPOS', pattern: /\bmyPOS\b/i },
  { name: 'Tim', pattern: /\bTIM\s+(?:Payment|Pay)\b/i },
  { name: 'BestPay', pattern: /\bBestPay\b/i },
];

export function detectBillingProviderName(text: string): DetectedBillingProvider | null {
  const haystack = text.replace(/\s+/g, ' ').trim();
  if (!haystack) {
    return null;
  }

  for (const entry of PROVIDER_PATTERNS) {
    if (entry.pattern.test(haystack)) {
      return { name: entry.name, confidence: 0.9 };
    }
  }

  const labeled = haystack.match(
    /(?:bisheriger\s+Anbieter|aktueller\s+Anbieter|Zahlungsdienstleister|Payment[- ]?Provider|Acquirer)\s*[:-]\s*([A-Za-zÄÖÜäöüß0-9 .&-]{2,40})/i,
  );
  if (labeled?.[1]) {
    return { name: labeled[1].trim(), confidence: 0.7 };
  }

  return null;
}

/** Kanonische BestPay A920-Tarife laut Flyer-Unterlagen (interne Produktcodes). */
export const BESTPAY_A920_TARIFFS_RAW = [
  {
    id: 'tariff_bestpay_a920_classic',
    name: 'BestPay Mobile A920 Classic',
    providerName: 'BestPay',
    productCode: 'BP-A920-CLASSIC',
    description:
      'Mobiles Android-Kartenterminal CCV A920 mit separater Miete, Servicepauschale und kartenabhängigen Entgelten.',
    status: 'active',
    supportedTerminalTypes: ['mobile'],
    monthlyAccountBaseFeeCents: 0,
    monthlyTerminalRentalCents: 995,
    monthlyServiceFeePerTerminalCents: 795,
    setupFeeCents: 7995,
    minimumMonthlyFeeCents: null,
    minimumContractMonths: null,
    noticePeriodMonths: null,
    includedTransactions: null,
    additionalTransactionFeeTenthsOfCent: 79,
    girocardClearingFeeTenthsOfCent: 19,
    girocardClearingIncluded: false,
    cardRates: {
      girocard: {
        percentageTenthsOfBasisPoint: 249,
        fixedFeeTenthsOfCent: 0,
      },
      debit: {
        percentageTenthsOfBasisPoint: 890,
        fixedFeeTenthsOfCent: 0,
      },
      credit: {
        percentageTenthsOfBasisPoint: 1190,
        fixedFeeTenthsOfCent: 0,
      },
      other: {
        percentageTenthsOfBasisPoint: 0,
        fixedFeeTenthsOfCent: 0,
      },
    },
    billingInterval: 'monthly',
    validFrom: null,
    validUntil: null,
    notes:
      'Quellenstand BestPay Mobile A920 Flyer. Girocard 0,249 % setzt sich laut Flyer aus 0,193 % DK-Autorisierungsentgelt und 0,056 % Serviceentgelt zusammen. Gemäß PLV Nexi können je nach Kartenart weitere Gebühren anfallen. Produktcode ist ein interner App-Code, da im Flyer kein offizieller Produktcode genannt wird.',
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
  {
    id: 'tariff_bestpay_a920_flat',
    name: 'BestPay Mobile A920 Flat',
    providerName: 'BestPay',
    productCode: 'BP-A920-FLAT',
    description:
      'Mobiles Android-Kartenterminal CCV A920 mit einheitlichem Kartenentgelt, reduzierter Transaktionsgebühr und inklusive Clearing.',
    status: 'active',
    supportedTerminalTypes: ['mobile'],
    monthlyAccountBaseFeeCents: 0,
    monthlyTerminalRentalCents: 0,
    monthlyServiceFeePerTerminalCents: 795,
    setupFeeCents: 7995,
    minimumMonthlyFeeCents: null,
    minimumContractMonths: null,
    noticePeriodMonths: null,
    includedTransactions: null,
    additionalTransactionFeeTenthsOfCent: 39,
    girocardClearingFeeTenthsOfCent: 0,
    girocardClearingIncluded: true,
    cardRates: {
      girocard: {
        percentageTenthsOfBasisPoint: 990,
        fixedFeeTenthsOfCent: 0,
      },
      debit: {
        percentageTenthsOfBasisPoint: 990,
        fixedFeeTenthsOfCent: 0,
      },
      credit: {
        percentageTenthsOfBasisPoint: 990,
        fixedFeeTenthsOfCent: 0,
      },
      other: {
        percentageTenthsOfBasisPoint: 0,
        fixedFeeTenthsOfCent: 0,
      },
    },
    billingInterval: 'monthly',
    validFrom: null,
    validUntil: null,
    notes:
      'Quellenstand BestPay Mobile A920 Flyer. Clearing und Terminalmiete sind laut Flyer inklusive. Das Flat-Kartenentgelt beträgt 0,99 %. Non-EWR- und Commercial-Card-Markups von 1,49 % beziehungsweise 1,59 % werden in A05 noch nicht berechnet. Produktcode ist ein interner App-Code, da im Flyer kein offizieller Produktcode genannt wird.',
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
] as const;

export const DEMO_PLACEHOLDER_TARIFF_IDS = new Set([
  'tariff_001',
  'tariff_002',
  'tariff_003',
]);

export const DEMO_PLACEHOLDER_PRODUCT_CODES = new Set([
  'BP-START',
  'BP-BUSINESS',
  'BP-FLEX',
]);

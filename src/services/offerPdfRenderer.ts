import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OfferItem } from '../domain/offer/offer';
import {
  OFFER_DOCUMENT_ON_REQUEST_NOTE,
  OFFER_DOCUMENT_PREVIEW_LABEL,
  OFFER_DOCUMENT_PRICE_BASIS_NOTE,
  OFFER_DOCUMENT_PROJECTION_BASIS_NOTE,
  OFFER_DOCUMENT_VARIABLE_FEES_NOTE,
} from '../domain/offerDocument/offerDocumentDefaults';
import type { OfferDocumentSnapshot } from '../domain/offerDocument/offerDocument';
import type { OfferDocumentCommercialSnapshot } from '../domain/offerDocument/offerDocumentCommercialSnapshot';
import { formatCentsToCurrency } from '../utils/currency';
import {
  formatCardRate,
  formatGirocardClearing,
  formatOptionalCents,
  formatOptionalMonths,
} from '../utils/formatTariff';
import { TERMINAL_TYPE_LABELS } from '../domain/tariff/tariff';
import { formatContactName, formatDate } from '../utils/format';

export interface RenderOfferPdfOptions {
  isPreview: boolean;
}

type Rgb = [number, number, number];

const BRAND: {
  ink: Rgb;
  muted: Rgb;
  line: Rgb;
  accent: Rgb;
  soft: Rgb;
} = {
  ink: [28, 36, 48],
  muted: [90, 98, 110],
  line: [210, 216, 224],
  accent: [18, 88, 122],
  soft: [242, 246, 249],
};

function formatItemUnitPrice(item: OfferItem): string {
  if (item.priceType === 'on_request') return 'auf Anfrage';
  if (item.priceType === 'included') return 'inklusive';
  if (item.unitPriceCents === null) return '';
  const amount = formatCentsToCurrency(item.unitPriceCents);
  return item.priceType === 'monthly' ? `${amount} / Monat` : `${amount} einmalig`;
}

function formatItemLineTotal(item: OfferItem): string {
  if (item.priceType === 'on_request') return 'auf Anfrage';
  if (item.priceType === 'included') return 'inklusive';
  if (item.unitPriceCents === null) return '';
  const amount = formatCentsToCurrency(item.quantity * item.unitPriceCents);
  return item.priceType === 'monthly' ? `${amount} / Monat` : `${amount} einmalig`;
}

function formatDateValue(value: string | null): string {
  if (!value) return '';
  return formatDate(value.includes('T') ? value : `${value}T00:00:00`);
}

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - 18) {
    return y;
  }
  doc.addPage();
  return margin;
}

function addFooter(doc: jsPDF, pageNumber: number, pageCount: number, offerNumber: string): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...BRAND.line);
  doc.setLineWidth(0.3);
  doc.line(20, pageHeight - 14, pageWidth - 20, pageHeight - 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(`Angebot ${offerNumber}`, 20, pageHeight - 9);
  doc.text(`Seite ${pageNumber} von ${pageCount}`, pageWidth - 20, pageHeight - 9, {
    align: 'right',
  });
}

function sectionTitle(doc: jsPDF, title: string, y: number, margin: number): number {
  y = ensureSpace(doc, y, 12, margin);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.accent);
  doc.text(title, margin, y);
  y += 2;
  doc.setDrawColor(...BRAND.line);
  doc.setLineWidth(0.4);
  doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y);
  return y + 6;
}

function renderCommercialSolutionSection(
  doc: jsPDF,
  commercial: OfferDocumentCommercialSnapshot,
  y: number,
  margin: number,
  contentWidth: number,
): number {
  y = sectionTitle(doc, 'Empfohlene Lösung', y, margin);
  const rows: Array<[string, string]> = [
    ['Tarif', commercial.tariffName],
    ['Terminal', commercial.terminalModel],
    ['Einsatzart', commercial.deploymentLabel],
    ['Vertragslaufzeit', formatOptionalMonths(commercial.contractTermMonths)],
    ['Terminalanzahl', String(commercial.terminalCount)],
  ];
  if (commercial.productName) {
    rows.splice(1, 0, ['Produkt', commercial.productName]);
  }

  autoTable(doc, {
    startY: y,
    body: rows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.8, textColor: BRAND.ink },
    columnStyles: {
      0: { cellWidth: 55, textColor: BRAND.muted },
      1: { cellWidth: contentWidth - 55 },
    },
    margin: { left: margin, right: margin },
  });
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
}

function renderCommercialFixedConditions(
  doc: jsPDF,
  commercial: OfferDocumentCommercialSnapshot,
  y: number,
  margin: number,
  contentWidth: number,
): number {
  y = sectionTitle(doc, 'Vertrags- und Tarifkonditionen', y, margin);
  const breakdown = commercial.breakdown;
  const rows: Array<[string, string]> = [
    ['Kontoführung / Fixkonto', `${formatCentsToCurrency(breakdown.monthlyAccountBaseCents)} / Monat`],
    ['Terminalmiete', `${formatCentsToCurrency(breakdown.monthlyTerminalRentalCents)} / Monat`],
    ['Servicepauschale', `${formatCentsToCurrency(breakdown.monthlyServiceCents)} / Monat`],
  ];
  if (commercial.deploymentMode === 'mobile_sim' && breakdown.monthlySimCents > 0) {
    rows.push(['SIM / Mobilfunk', `${formatCentsToCurrency(breakdown.monthlySimCents)} / Monat`]);
  }
  rows.push(
    ['Monatliche Fixkosten gesamt', `${formatCentsToCurrency(breakdown.monthlyFixedTotalCents)} / Monat`],
    ['Einrichtungsgebühr', `${formatCentsToCurrency(breakdown.oneTimeSetupCents)} einmalig`],
  );
  if (breakdown.oneTimeHardwareCents > 0) {
    rows.push(['Hardware einmalig', `${formatCentsToCurrency(breakdown.oneTimeHardwareCents)} einmalig`]);
  }

  autoTable(doc, {
    startY: y,
    body: rows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.8, textColor: BRAND.ink },
    columnStyles: {
      0: { cellWidth: 70, textColor: BRAND.muted },
      1: { cellWidth: contentWidth - 70 },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  y += 6;

  y = sectionTitle(doc, 'Variable Tarifkonditionen', y, margin);
  const variableLines = [
    `Transaktionsentgelt: ${formatCentsToCurrency(Math.round(commercial.transactionFeeTenthsOfCent / 10))}`,
    `Girocard-Clearing: ${formatGirocardClearing(
      commercial.girocardClearingIncluded,
      commercial.girocardClearingFeeTenthsOfCent,
    )}`,
    `Girocard: ${formatCardRate(commercial.cardRates.girocard)}`,
    `Debitkarte: ${formatCardRate(commercial.cardRates.debit)}`,
    `Kreditkarte: ${formatCardRate(commercial.cardRates.credit)}`,
  ];
  variableLines.forEach((line) => {
    y = ensureSpace(doc, y, 6, margin);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.ink);
    doc.text(line, margin, y);
    y += 5;
  });
  return y + 4;
}

function renderCommercialProjectionSection(
  doc: jsPDF,
  commercial: OfferDocumentCommercialSnapshot,
  y: number,
  margin: number,
  contentWidth: number,
): number {
  y = sectionTitle(doc, 'Kostenprognose', y, margin);
  const basisRows: Array<[string, string]> = [];
  if (commercial.needBasis.monthlyCardVolumeCents !== null) {
    basisRows.push([
      'Monatsumsatz (Annahme)',
      formatCentsToCurrency(commercial.needBasis.monthlyCardVolumeCents),
    ]);
  }
  if (commercial.needBasis.monthlyTransactions !== null) {
    basisRows.push(['Transaktionen / Monat (Annahme)', String(commercial.needBasis.monthlyTransactions)]);
  }
  if (commercial.needBasis.cardMixSummary) {
    basisRows.push(['Kartenmix (Annahme)', commercial.needBasis.cardMixSummary]);
  }

  if (basisRows.length > 0) {
    autoTable(doc, {
      startY: y,
      body: basisRows,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 1.8, textColor: BRAND.ink },
      columnStyles: {
        0: { cellWidth: 70, textColor: BRAND.muted },
        1: { cellWidth: contentWidth - 70 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 16;
    y += 4;
  }

  const breakdown = commercial.breakdown;
  autoTable(doc, {
    startY: y,
    body: [
      ['Geschätzte variable Kosten / Monat', `${formatCentsToCurrency(breakdown.monthlyVariableTotalCents)} / Monat`],
      [
        'Geschätzte Gesamtkosten / Monat (Fix + variabel)',
        `${formatCentsToCurrency(breakdown.monthlyTotalCents)} / Monat`,
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2, textColor: BRAND.ink },
    columnStyles: {
      0: { cellWidth: 95, textColor: BRAND.muted },
      1: { cellWidth: contentWidth - 95 },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 12;
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  for (const note of [
    OFFER_DOCUMENT_PROJECTION_BASIS_NOTE,
    ...commercial.projectionAssumptions,
  ]) {
    const lines = doc.splitTextToSize(note, contentWidth);
    y = ensureSpace(doc, y, lines.length * 4 + 2, margin);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  }

  return y + 4;
}

function renderCommercialDisclosures(
  doc: jsPDF,
  commercial: OfferDocumentCommercialSnapshot,
  y: number,
  margin: number,
  contentWidth: number,
): number {
  const notes = [
    ...commercial.customerDisclosures,
    ...commercial.flatMarkupDisclosures,
    commercial.fairnessGuaranteeNote,
  ].filter(Boolean) as string[];

  if (notes.length === 0) {
    return y;
  }

  y = sectionTitle(doc, 'Weitere Hinweise', y, margin);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.ink);
  for (const note of notes) {
    const lines = doc.splitTextToSize(note, contentWidth);
    y = ensureSpace(doc, y, lines.length * 4 + 2, margin);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  }
  return y + 4;
}

export function renderOfferPdf(
  snapshot: OfferDocumentSnapshot,
  options: RenderOfferPdfOptions,
): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  if (options.isPreview) {
    doc.setFontSize(34);
    doc.setTextColor(200, 80, 80);
    doc.text(OFFER_DOCUMENT_PREVIEW_LABEL, pageWidth / 2, 50, { align: 'center', angle: 32 });
  }

  // Kopfband
  doc.setFillColor(...BRAND.soft);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.accent);
  const senderName = snapshot.sender.legalForm
    ? `${snapshot.sender.companyName} ${snapshot.sender.legalForm}`
    : snapshot.sender.companyName;
  doc.text(senderName || 'AMRtech', margin, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.muted);
  const senderMeta = [
    snapshot.sender.phone ? `Tel. ${snapshot.sender.phone}` : null,
    snapshot.sender.email,
    snapshot.sender.website,
  ]
    .filter(Boolean)
    .join(' · ');
  if (senderMeta) {
    doc.text(senderMeta, margin, 21);
  }

  y = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...BRAND.ink);
  doc.text('Ihr Angebot', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.muted);
  doc.text('Transparente Konditionen für Ihr Kartenzahlungsangebot', margin, y);
  y += 10;

  // Meta + Kunde
  const customerLines = [
    snapshot.customer.companyName,
    formatContactName(snapshot.customer.contactFirstName, snapshot.customer.contactLastName),
    snapshot.customer.street,
    `${snapshot.customer.postalCode} ${snapshot.customer.city}`.trim(),
  ].filter(Boolean);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BRAND.line);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.muted);
  doc.text('Kunde', margin + 4, y + 6);
  doc.text('Angaben', margin + contentWidth / 2 + 2, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.ink);
  let cy = y + 11;
  customerLines.slice(0, 3).forEach((line) => {
    doc.text(line, margin + 4, cy);
    cy += 4.5;
  });
  const metaPairs = [
    ['Nummer', snapshot.offerNumber],
    ['Datum', formatDateValue(snapshot.generatedAt.slice(0, 10))],
    snapshot.validUntil ? ['Gültig bis', formatDateValue(snapshot.validUntil)] : null,
    ['Ansprechpartner', snapshot.generatedByDisplayName],
  ].filter(Boolean) as Array<[string, string]>;
  let my = y + 11;
  metaPairs.forEach(([label, value]) => {
    doc.setTextColor(...BRAND.muted);
    doc.text(`${label}:`, margin + contentWidth / 2 + 2, my);
    doc.setTextColor(...BRAND.ink);
    doc.text(value, margin + contentWidth / 2 + 32, my);
    my += 4.5;
  });
  y += 34;

  if (snapshot.introductionText.trim()) {
    y = sectionTitle(doc, 'Empfehlung', y, margin);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.ink);
    const intro = doc.splitTextToSize(snapshot.introductionText, contentWidth);
    y = ensureSpace(doc, y, intro.length * 5 + 4, margin);
    doc.text(intro, margin, y);
    y += intro.length * 5 + 6;
  }

  if (snapshot.commercial) {
    y = renderCommercialSolutionSection(doc, snapshot.commercial, y, margin, contentWidth);
    y += 6;
    y = renderCommercialFixedConditions(doc, snapshot.commercial, y, margin, contentWidth);
  } else if (snapshot.tariff) {
    y = sectionTitle(doc, 'Empfohlene Lösung', y, margin);
    const tariff = snapshot.tariff;
    const monthlyFixed =
      tariff.monthlyAccountBaseFeeCents +
      tariff.monthlyTerminalRentalCents +
      tariff.monthlyServiceFeePerTerminalCents;
    const solutionRows: Array<[string, string]> = [
      ['Tarif', tariff.name],
      ['Terminal', TERMINAL_TYPE_LABELS[tariff.terminalType]],
    ];
    if (tariff.contractDurationMonths != null) {
      solutionRows.push(['Vertragslaufzeit', formatOptionalMonths(tariff.contractDurationMonths)]);
    }
    if (tariff.noticePeriodMonths != null) {
      solutionRows.push(['Kündigungsfrist', formatOptionalMonths(tariff.noticePeriodMonths)]);
    }
    solutionRows.push(
      ['Monatliche Fixkosten', `${formatCentsToCurrency(monthlyFixed)} / Monat`],
      ['Einrichtungsgebühr', `${formatCentsToCurrency(tariff.setupFeeCents)} einmalig`],
    );

    autoTable(doc, {
      startY: y,
      body: solutionRows,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 1.8, textColor: BRAND.ink },
      columnStyles: {
        0: { cellWidth: 55, textColor: BRAND.muted },
        1: { cellWidth: contentWidth - 55 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
    y += 6;

    y = sectionTitle(doc, 'Variable Gebühren', y, margin);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.ink);
    const variableLines = [
      `Transaktionsentgelt: ${formatCentsToCurrency(Math.round(tariff.transactionFeeTenthsOfCent / 10))}`,
      `Girocard-Clearing: ${formatGirocardClearing(
        tariff.girocardClearingIncluded,
        tariff.girocardClearingFeeTenthsOfCent,
      )}`,
      `Girocard: ${formatCardRate({
        percentageTenthsOfBasisPoint: tariff.girocardRateTenthsOfBasisPoint,
        fixedFeeTenthsOfCent: 0,
      })}`,
      `Debitkarte: ${formatCardRate({
        percentageTenthsOfBasisPoint: tariff.debitCardRateTenthsOfBasisPoint,
        fixedFeeTenthsOfCent: 0,
      })}`,
      `Kreditkarte: ${formatCardRate({
        percentageTenthsOfBasisPoint: tariff.creditCardRateTenthsOfBasisPoint,
        fixedFeeTenthsOfCent: 0,
      })}`,
    ];
    if (tariff.minimumTurnoverCents != null) {
      variableLines.push(`Mindestumsatz: ${formatOptionalCents(tariff.minimumTurnoverCents)}`);
    }
    variableLines.forEach((line) => {
      y = ensureSpace(doc, y, 6, margin);
      doc.text(line, margin, y);
      y += 5;
    });
    y += 4;
  }

  const visibleItems = snapshot.items.filter((item) => {
    if (item.priceType === 'included' && !item.name.trim()) return false;
    return true;
  });

  if (visibleItems.length > 0) {
    y = sectionTitle(doc, 'Leistungen und Hardware', y, margin);
    autoTable(doc, {
      startY: y,
      head: [['Position', 'Menge', 'Preis', 'Gesamt']],
      body: visibleItems.map((item) => [
        item.description.trim() ? `${item.name}\n${item.description}` : item.name,
        String(item.quantity),
        formatItemUnitPrice(item),
        formatItemLineTotal(item),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2.2, overflow: 'linebreak', textColor: BRAND.ink },
      headStyles: { fillColor: BRAND.accent, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: BRAND.soft },
      theme: 'grid',
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
    y += 8;
  }

  if (snapshot.commercial) {
    y = renderCommercialProjectionSection(doc, snapshot.commercial, y, margin, contentWidth);
  }

  y = sectionTitle(doc, 'Kostenübersicht', y, margin);
  const totals = snapshot.totals;
  autoTable(doc, {
    startY: y,
    body: [
      ['Monatlich gesamt', `${formatCentsToCurrency(totals.monthlyTotalCents)} / Monat`],
      ['Einmalig gesamt', `${formatCentsToCurrency(totals.oneTimeTotalCents)} einmalig`],
    ],
    theme: 'plain',
    styles: { fontSize: 11, cellPadding: 2, fontStyle: 'bold', textColor: BRAND.ink },
    columnStyles: {
      0: { cellWidth: 60, textColor: BRAND.muted, fontStyle: 'normal' },
      1: { cellWidth: contentWidth - 60 },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 12;
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  for (const note of [
    OFFER_DOCUMENT_PRICE_BASIS_NOTE,
    OFFER_DOCUMENT_VARIABLE_FEES_NOTE,
    totals.hasOnRequestItems ? OFFER_DOCUMENT_ON_REQUEST_NOTE : null,
  ].filter(Boolean) as string[]) {
    const lines = doc.splitTextToSize(note, contentWidth);
    y = ensureSpace(doc, y, lines.length * 4 + 2, margin);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  }

  if (snapshot.commercial) {
    y = renderCommercialDisclosures(doc, snapshot.commercial, y, margin, contentWidth);
  }

  if (snapshot.customerNotes.trim()) {
    y = sectionTitle(doc, 'Hinweise', y, margin);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.ink);
    const notes = doc.splitTextToSize(snapshot.customerNotes, contentWidth);
    y = ensureSpace(doc, y, notes.length * 5 + 4, margin);
    doc.text(notes, margin, y);
    y += notes.length * 5 + 6;
  }

  y = sectionTitle(doc, 'Nächste Schritte', y, margin);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.ink);
  const nextSteps = [
    '1. Angebot prüfen und bei Bedarf Rückfragen stellen.',
    '2. Angebot annehmen oder gewünschte Änderungen mitteilen.',
    '3. Der Vertragsabschluss erfolgt anschließend mit BestPay.',
  ];
  nextSteps.forEach((line) => {
    y = ensureSpace(doc, y, 6, margin);
    doc.text(line, margin, y);
    y += 5;
  });
  y += 6;

  y = sectionTitle(doc, 'Ansprechpartner', y, margin);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.ink);
  const contactLines = [
    snapshot.generatedByDisplayName,
    senderName,
    snapshot.sender.street,
    `${snapshot.sender.postalCode} ${snapshot.sender.city}`.trim(),
    snapshot.sender.phone ? `Tel.: ${snapshot.sender.phone}` : null,
    snapshot.sender.email,
  ].filter(Boolean) as string[];
  contactLines.forEach((line) => {
    y = ensureSpace(doc, y, 5, margin);
    doc.text(line, margin, y);
    y += 4.5;
  });

  const legal = [
    snapshot.sender.registerCourt && snapshot.sender.registerNumber
      ? `${snapshot.sender.registerCourt} ${snapshot.sender.registerNumber}`
      : null,
    snapshot.sender.vatId ? `USt-IdNr.: ${snapshot.sender.vatId}` : null,
  ].filter(Boolean) as string[];
  if (legal.length) {
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    legal.forEach((line) => {
      y = ensureSpace(doc, y, 4, margin);
      doc.text(line, margin, y);
      y += 4;
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    addFooter(doc, page, pageCount, snapshot.offerNumber);
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

export function renderOfferPdfBlob(
  snapshot: OfferDocumentSnapshot,
  options: RenderOfferPdfOptions,
): Blob {
  const bytes = renderOfferPdf(snapshot, options);
  return new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' });
}

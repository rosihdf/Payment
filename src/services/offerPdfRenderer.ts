import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OfferItem } from '../domain/offer/offer';
import {
  OFFER_DOCUMENT_ON_REQUEST_NOTE,
  OFFER_DOCUMENT_PREVIEW_LABEL,
  OFFER_DOCUMENT_PRICE_BASIS_NOTE,
  OFFER_DOCUMENT_VARIABLE_FEES_NOTE,
} from '../domain/offerDocument/offerDocumentDefaults';
import type { OfferDocumentSnapshot } from '../domain/offerDocument/offerDocument';
import { formatContactName, formatDate } from '../utils/format';
import { formatCentsToCurrency } from '../utils/currency';
import { formatCardRate, formatGirocardClearing, formatOptionalCents, formatOptionalMonths } from '../utils/formatTariff';
import { TERMINAL_TYPE_LABELS } from '../domain/tariff/tariff';

export interface RenderOfferPdfOptions {
  isPreview: boolean;
}

function formatItemUnitPrice(item: OfferItem): string {
  if (item.priceType === 'on_request') {
    return 'auf Anfrage';
  }

  if (item.priceType === 'included') {
    return 'inklusive';
  }

  if (item.unitPriceCents === null) {
    return '—';
  }

  const amount = formatCentsToCurrency(item.unitPriceCents);
  return item.priceType === 'monthly' ? `${amount} / Monat` : `${amount} einmalig`;
}

function formatItemLineTotal(item: OfferItem): string {
  if (item.priceType === 'on_request') {
    return 'auf Anfrage';
  }

  if (item.priceType === 'included') {
    return 'inklusive';
  }

  if (item.unitPriceCents === null) {
    return '—';
  }

  const total = item.quantity * item.unitPriceCents;
  const amount = formatCentsToCurrency(total);
  return item.priceType === 'monthly' ? `${amount} / Monat` : `${amount} einmalig`;
}

function formatDateValue(value: string | null): string {
  if (!value) {
    return '—';
  }

  return formatDate(value.includes('T') ? value : `${value}T00:00:00`);
}

function addFooter(doc: jsPDF, pageNumber: number, pageCount: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Seite ${pageNumber} von ${pageCount}`, pageWidth - 20, pageHeight - 10, {
    align: 'right',
  });
}

function buildSenderLines(snapshot: OfferDocumentSnapshot): string[] {
  const sender = snapshot.sender;
  const lines = [sender.companyName];

  if (sender.legalForm) {
    lines[0] = `${sender.companyName} ${sender.legalForm}`;
  }

  if (sender.street) {
    lines.push(sender.street);
  }

  if (sender.postalCode || sender.city) {
    lines.push(`${sender.postalCode} ${sender.city}`.trim());
  }

  if (sender.phone) {
    lines.push(`Tel.: ${sender.phone}`);
  }

  if (sender.email) {
    lines.push(sender.email);
  }

  if (sender.website) {
    lines.push(sender.website);
  }

  return lines;
}

function buildCustomerLines(snapshot: OfferDocumentSnapshot): string[] {
  const customer = snapshot.customer;
  return [
    customer.companyName,
    formatContactName(customer.contactFirstName, customer.contactLastName),
    customer.street,
    `${customer.postalCode} ${customer.city}`.trim(),
  ].filter(Boolean);
}

export function renderOfferPdf(
  snapshot: OfferDocumentSnapshot,
  options: RenderOfferPdfOptions,
): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = margin;

  if (options.isPreview) {
    doc.setFontSize(28);
    doc.setTextColor(180, 0, 0);
    doc.text(OFFER_DOCUMENT_PREVIEW_LABEL, pageWidth / 2, 40, { align: 'center', angle: 35 });
    doc.setTextColor(0, 0, 0);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  buildSenderLines(snapshot).forEach((line) => {
    doc.text(line, margin, y);
    y += 5;
  });

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  buildCustomerLines(snapshot).forEach((line) => {
    doc.text(line, margin, y);
    y += 5;
  });

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Angebot', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const metaLines = [
    `Angebotsnummer: ${snapshot.offerNumber}`,
    options.isPreview
      ? 'Dokumentversion: Vorschau'
      : `Dokumentversion: ${snapshot.documentNumber}`,
    `Erstellungsdatum: ${formatDateValue(snapshot.generatedAt.slice(0, 10))}`,
    snapshot.validUntil ? `Gültig bis: ${formatDateValue(snapshot.validUntil)}` : null,
    `Erstellt von: ${snapshot.generatedByDisplayName}`,
    `Titel: ${snapshot.title}`,
  ].filter(Boolean) as string[];

  metaLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 5;
  });

  y += 4;

  if (snapshot.introductionText.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.text('Einleitung', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const introLines = doc.splitTextToSize(snapshot.introductionText, pageWidth - margin * 2);
    doc.text(introLines, margin, y);
    y += introLines.length * 5 + 4;
  }

  if (snapshot.tariff) {
    if (y > 240) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Payment-Tarif', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');

    const tariff = snapshot.tariff;
    const tariffLines = [
      `Tarif: ${tariff.name}`,
      `Terminalart: ${TERMINAL_TYPE_LABELS[tariff.terminalType]}`,
      '',
      'Feste Kosten',
      `Monatliche Fixkosten: ${formatCentsToCurrency(
        tariff.monthlyAccountBaseFeeCents +
          tariff.monthlyTerminalRentalCents +
          tariff.monthlyServiceFeePerTerminalCents,
      )} / Monat`,
      `Einrichtungsgebühr: ${formatCentsToCurrency(tariff.setupFeeCents)} einmalig`,
      '',
      'Variable Konditionen',
      `Transaktionsentgelt: ${formatCentsToCurrency(Math.round(tariff.transactionFeeTenthsOfCent / 10))}`,
      `Girocard-Clearing: ${formatGirocardClearing(
        tariff.girocardClearingIncluded,
        tariff.girocardClearingFeeTenthsOfCent,
      )}`,
      `Girocard-Satz: ${formatCardRate({
        percentageTenthsOfBasisPoint: tariff.girocardRateTenthsOfBasisPoint,
        fixedFeeTenthsOfCent: 0,
      })}`,
      `Debitkartensatz: ${formatCardRate({
        percentageTenthsOfBasisPoint: tariff.debitCardRateTenthsOfBasisPoint,
        fixedFeeTenthsOfCent: 0,
      })}`,
      `Kreditkartensatz: ${formatCardRate({
        percentageTenthsOfBasisPoint: tariff.creditCardRateTenthsOfBasisPoint,
        fixedFeeTenthsOfCent: 0,
      })}`,
      `Vertragslaufzeit: ${formatOptionalMonths(tariff.contractDurationMonths)}`,
      `Kündigungsfrist: ${formatOptionalMonths(tariff.noticePeriodMonths)}`,
      `Mindestumsatz: ${formatOptionalCents(tariff.minimumTurnoverCents)}`,
    ];

    tariffLines.forEach((line) => {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      if (line === '') {
        y += 2;
        return;
      }
      doc.text(line, margin, y);
      y += 5;
    });

    y += 4;
  }

  if (snapshot.items.length > 0) {
    if (y > 220) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Positionen', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Pos.', 'Bezeichnung', 'Menge', 'Preisart', 'Einzelpreis', 'Gesamt']],
      body: snapshot.items.map((item, index) => [
        String(index + 1),
        item.description.trim() ? `${item.name}\n${item.description}` : item.name,
        String(item.quantity),
        item.priceType === 'monthly'
          ? 'monatlich'
          : item.priceType === 'one_time'
            ? 'einmalig'
            : item.priceType === 'included'
              ? 'inklusive'
              : 'auf Anfrage',
        formatItemUnitPrice(item),
        formatItemLineTotal(item),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 58, 95], textColor: 255 },
      theme: 'grid',
    });

    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
    y += 8;
  }

  if (y > 230) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Summen', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');

  const totals = snapshot.totals;
  const sumLines = [
    `Monatliche Tarifkosten: ${formatCentsToCurrency(totals.tariffMonthlyFixedTotalCents)} / Monat`,
    `Monatliche Produktkosten: ${formatCentsToCurrency(totals.monthlyItemsTotalCents)} / Monat`,
    `Monatliche Gesamtkosten: ${formatCentsToCurrency(totals.monthlyTotalCents)} / Monat`,
    '',
    `Einmalige Tarifkosten: ${formatCentsToCurrency(totals.tariffSetupTotalCents)} einmalig`,
    `Einmalige Produktkosten: ${formatCentsToCurrency(totals.oneTimeItemsTotalCents)} einmalig`,
    `Einmalige Gesamtkosten: ${formatCentsToCurrency(totals.oneTimeTotalCents)} einmalig`,
  ];

  sumLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 5;
  });

  y += 3;
  doc.setFontSize(9);
  doc.text(OFFER_DOCUMENT_PRICE_BASIS_NOTE, margin, y);
  y += 5;
  doc.text(OFFER_DOCUMENT_VARIABLE_FEES_NOTE, margin, y);
  y += 5;

  if (totals.hasOnRequestItems) {
    doc.text(OFFER_DOCUMENT_ON_REQUEST_NOTE, margin, y);
    y += 5;
  }

  if (snapshot.customerNotes.trim()) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Kundenhinweis', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(snapshot.customerNotes, pageWidth - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 5 + 4;
  }

  if (y > 240) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Kontakt', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  buildSenderLines(snapshot).forEach((line) => {
    doc.text(line, margin, y);
    y += 5;
  });

  const footerLines = [
    snapshot.sender.registerCourt && snapshot.sender.registerNumber
      ? `${snapshot.sender.registerCourt} ${snapshot.sender.registerNumber}`
      : null,
    snapshot.sender.vatId ? `USt-IdNr.: ${snapshot.sender.vatId}` : null,
    snapshot.sender.bankName && snapshot.sender.iban
      ? `Bank: ${snapshot.sender.bankName}, IBAN: ${snapshot.sender.iban}${snapshot.sender.bic ? `, BIC: ${snapshot.sender.bic}` : ''}`
      : null,
  ].filter(Boolean) as string[];

  footerLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 5;
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    addFooter(doc, page, pageCount);
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

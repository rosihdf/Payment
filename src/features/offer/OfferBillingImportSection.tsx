import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { BillingCostLineCategory, BillingCostLineCostType } from '../../domain/billingImport/billingCostLineItem';
import { BILLING_COST_LINE_CATEGORY_LABELS } from '../../domain/billingImport/billingCostLineItem';
import type { Offer } from '../../domain/offer/offer';
import type { OfferUserContext } from '../../services/offerService';
import type { BillingImportService } from '../../services/billingImportService';
import type { SalesBillingImportView } from '../../services/billingImportViews';
import { BILLING_FILE_LIMITS } from '../../domain/billingImportEngine/billingFileValidation';
import { FormControl } from '../../components/common/FormControl';
import styles from './OfferBillingImportSection.module.css';

interface OfferBillingImportSectionProps {
  offer?: Offer;
  sessionId?: string;
  userContext: OfferUserContext;
  billingImportService: BillingImportService;
  showToast: (message: string, variant: 'success' | 'error') => void;
  onBaselineConfirmed?: () => void;
  title?: string;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

const COST_CATEGORIES = Object.keys(BILLING_COST_LINE_CATEGORY_LABELS) as BillingCostLineCategory[];

export function OfferBillingImportSection({
  offer,
  sessionId,
  userContext,
  billingImportService,
  showToast,
  onBaselineConfirmed,
  title = 'Bestehende Abrechnungen',
}: OfferBillingImportSectionProps) {
  const [view, setView] = useState<SalesBillingImportView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [fieldEdits, setFieldEdits] = useState<Record<string, string>>({});
  const [showManualPeriod, setShowManualPeriod] = useState(false);
  const [showCostLineForm, setShowCostLineForm] = useState(false);
  const [manualPeriodFrom, setManualPeriodFrom] = useState('');
  const [manualPeriodTo, setManualPeriodTo] = useState('');
  const [manualCardVolume, setManualCardVolume] = useState('');
  const [manualTransactions, setManualTransactions] = useState('');
  const [manualFixedCosts, setManualFixedCosts] = useState('');
  const [manualTerminalCosts, setManualTerminalCosts] = useState('');
  const [manualTransactionCosts, setManualTransactionCosts] = useState('');
  const [manualTotal, setManualTotal] = useState('');
  const [costLineCategory, setCostLineCategory] = useState<BillingCostLineCategory>('transaction_fee');
  const [costLineLabel, setCostLineLabel] = useState('');
  const [costLineAmount, setCostLineAmount] = useState('');
  const [costLineType, setCostLineType] = useState<BillingCostLineCostType>('recurring');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isDraftContext = !offer || offer.status === 'draft';

  const loadView = useCallback(async () => {
    setIsLoading(true);
    const salesView = sessionId
      ? await billingImportService.getSalesViewForSession(sessionId, userContext)
      : offer
        ? await billingImportService.getSalesViewForOffer(offer.id, userContext)
        : null;
    setView(salesView);
    if (salesView) {
      setFieldEdits(
        Object.fromEntries(salesView.fields.map((field) => [field.id, field.editValue])),
      );
    }
    setIsLoading(false);
  }, [billingImportService, offer, sessionId, userContext]);

  useEffect(() => {
    void loadView();
  }, [loadView]);

  const parseEuroToCents = (value: string): number | null => {
    const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.round(parsed * 100);
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !view?.sessionId) {
      return;
    }
    void (async () => {
      setIsUploading(true);
      const result = await billingImportService.addFilesToSession(
        view.sessionId!,
        Array.from(fileList),
        userContext,
      );
      if (result.ok) {
        showToast(`${result.documents.length} Datei(en) hinzugefügt`, 'success');
        await loadView();
      } else {
        showToast('Datei konnte nicht hinzugefügt werden', 'error');
      }
      setIsUploading(false);
    })();
  };

  const handleExtractAll = () => {
    if (!view?.sessionId) {
      return;
    }
    void (async () => {
      setIsExtracting(true);
      await billingImportService.extractAllPendingDocuments(view.sessionId!, userContext);
      showToast('Extraktion abgeschlossen – bitte Werte prüfen', 'success');
      await loadView();
      setIsExtracting(false);
    })();
  };

  const handleCancelExtraction = () => {
    if (!view?.sessionId) {
      return;
    }
    billingImportService.cancelExtraction(view.sessionId, userContext);
    setIsExtracting(false);
    showToast('Extraktion abgebrochen', 'success');
    void loadView();
  };

  const handleRotate = (documentId: string, direction: 'left' | 'right' | 'reset') => {
    if (!view?.sessionId) {
      return;
    }
    billingImportService.rotateDocument(view.sessionId, documentId, direction, userContext);
    void loadView();
  };

  const handleConfirmField = (fieldId: string) => {
    void (async () => {
      await billingImportService.updateField(fieldId, { status: 'confirmed' }, userContext);
      await loadView();
    })();
  };

  const handleSaveCorrection = (fieldId: string) => {
    void (async () => {
      const value = fieldEdits[fieldId] ?? '';
      const result = await billingImportService.correctField(fieldId, value, userContext);
      if (result) {
        showToast('Wert korrigiert', 'success');
        await loadView();
      } else {
        showToast('Korrektur ungültig', 'error');
      }
    })();
  };

  const handleResetField = (fieldId: string) => {
    void (async () => {
      await billingImportService.resetFieldToDetected(fieldId, userContext);
      await loadView();
    })();
  };

  const handleRejectField = (fieldId: string) => {
    void (async () => {
      await billingImportService.updateField(fieldId, { status: 'rejected' }, userContext);
      await loadView();
    })();
  };

  const handleSelectCandidate = (fieldId: string) => {
    void (async () => {
      await billingImportService.selectFieldCandidate(fieldId, userContext);
      await loadView();
    })();
  };

  const handleAddCostLine = () => {
    if (!view?.sessionId || !costLineLabel || !costLineAmount) {
      showToast('Bezeichnung und Betrag erforderlich', 'error');
      return;
    }
    const amountCents = parseEuroToCents(costLineAmount);
    if (amountCents === null) {
      showToast('Ungültiger Betrag', 'error');
      return;
    }
    void (async () => {
      await billingImportService.addCostLineItem(
        view.sessionId!,
        {
          category: costLineCategory,
          label: costLineLabel,
          amountCents,
          currency: 'EUR',
          costType: costLineType,
        },
        userContext,
      );
      setCostLineLabel('');
      setCostLineAmount('');
      setShowCostLineForm(false);
      showToast('Gebührenposition hinzugefügt', 'success');
      await loadView();
    })();
  };

  const handleRemoveCostLine = (itemId: string) => {
    void (async () => {
      billingImportService.removeCostLineItem(itemId, userContext);
      await loadView();
    })();
  };

  const handleConfirmBaseline = () => {
    if (!view?.sessionId) {
      return;
    }
    void (async () => {
      setIsConfirming(true);
      const baseline = await billingImportService.confirmSessionBaseline(view.sessionId!, userContext);
      if (baseline) {
        showToast('Ist-Kostenbasis bestätigt und für A11 übernommen', 'success');
        onBaselineConfirmed?.();
        await loadView();
      } else {
        showToast('Bestätigung blockiert – bitte offene Prüfpunkte lösen', 'error');
      }
      setIsConfirming(false);
    })();
  };

  const handleManualPeriod = () => {
    if (!view?.sessionId || !manualPeriodFrom || !manualPeriodTo) {
      showToast('Zeitraum von/bis ist erforderlich', 'error');
      return;
    }
    void (async () => {
      await billingImportService.addManualPeriodToSession(
        view.sessionId!,
        {
          periodFrom: manualPeriodFrom,
          periodTo: manualPeriodTo,
          currency: 'EUR',
          cardVolumeCents: parseEuroToCents(manualCardVolume),
          transactionCount: manualTransactions ? Number.parseInt(manualTransactions, 10) : null,
          fixedCostsCents: parseEuroToCents(manualFixedCosts),
          terminalCostsCents: parseEuroToCents(manualTerminalCosts),
          transactionCostsCents: parseEuroToCents(manualTransactionCosts),
          totalAmountCents: parseEuroToCents(manualTotal),
        },
        userContext,
      );
      showToast('Manuelle Periode erfasst', 'success');
      setShowManualPeriod(false);
      await loadView();
    })();
  };

  const maxSizeMb = Math.round(BILLING_FILE_LIMITS.maxFileSizeBytes / (1024 * 1024));
  const inputTypeForField = (type: string) => {
    if (type === 'integer') {
      return 'number';
    }
    if (type === 'date') {
      return 'date';
    }
    return 'text';
  };

  return (
    <section className={styles.detailSection}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p className={styles.sectionHint}>
        Fotos, Bilder und gescannte PDFs werden lokal per OCR erkannt. Maschinenlesbare PDFs
        werden ohne unnötige OCR verarbeitet. Alle Werte müssen vor der Übernahme geprüft werden.
      </p>
      <p className={styles.privacyNotice}>{view?.privacyNotice}</p>

      {isLoading ? (
        <p className={styles.sectionHint}>Abrechnungsimport wird geladen…</p>
      ) : !view ? (
        <p className={styles.sectionHint}>Keine Berechtigung für den Abrechnungsimport.</p>
      ) : (
        <>
          {view.baseline ? (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Bestätigte Ist-Kostenbasis</h3>
              <DetailRow label="Status" value={view.baseline.status} />
              <DetailRow label="Datenqualität" value={view.baseline.qualityStatus} />
              <DetailRow label="Ø Gesamtkosten / Monat" value={view.baseline.avgMonthlyTotalCostsLabel} />
            </div>
          ) : null}

          {view.baselinePreview ? (
            <div className={`${styles.card} ${styles.baselinePreview}`}>
              <h3 className={styles.cardTitle}>Baseline-Vorschau (unbestätigt)</h3>
              <DetailRow label="Datenqualität" value={view.baselinePreview.qualityStatus} />
              <DetailRow label="Ø Gesamtkosten / Monat" value={view.baselinePreview.avgMonthlyTotalCostsLabel} />
              <DetailRow label="Perioden" value={String(view.baselinePreview.periodCount)} />
            </div>
          ) : null}

          <div className={styles.uploadArea}>
            <p className={styles.sectionHint}>
              {view.supportedFormatsLabel}. Max. {maxSizeMb} MB, bis zu{' '}
              {BILLING_FILE_LIMITS.maxFilesPerSession} Dateien.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className={styles.fileInput}
              accept="application/pdf,image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                handleFilesSelected(event.target.files);
                event.target.value = '';
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              className={styles.fileInput}
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(event) => {
                handleFilesSelected(event.target.files);
                event.target.value = '';
              }}
            />
            <div className={styles.uploadButtons}>
              <button type="button" className={styles.primaryAction} disabled={isUploading || !isDraftContext} onClick={() => fileInputRef.current?.click()}>
                Datei auswählen
              </button>
              <button type="button" className={styles.secondaryAction} disabled={isUploading || !isDraftContext} onClick={() => cameraInputRef.current?.click()}>
                Foto aufnehmen
              </button>
              <button type="button" className={styles.secondaryAction} disabled={isExtracting || view.documents.length === 0} onClick={handleExtractAll}>
                {isExtracting ? 'OCR läuft…' : 'OCR starten'}
              </button>
              {isExtracting ? (
                <button type="button" className={styles.secondaryAction} onClick={handleCancelExtraction}>
                  Abbrechen
                </button>
              ) : null}
              <button type="button" className={styles.secondaryAction} onClick={() => setShowManualPeriod((v) => !v)}>
                Periode manuell
              </button>
              <button type="button" className={styles.secondaryAction} onClick={() => setShowCostLineForm((v) => !v)}>
                Gebühr hinzufügen
              </button>
            </div>
          </div>

          {view.documents.map((document) => (
            <div key={document.id} className={styles.card}>
              <DetailRow label="Datei" value={document.fileName} />
              <DetailRow label="Status" value={document.extractionStatus} />
              {document.extractionProgress ? (
                <p className={styles.progressBar}>{document.extractionProgress.message}</p>
              ) : null}
              <DetailRow label="Rotation" value={`${document.rotationDegrees}°`} />
              {document.previewUrl ? (
                <img src={document.previewUrl} alt="" className={styles.previewImage} />
              ) : null}
              <div className={styles.fieldActions}>
                <button type="button" className={styles.secondaryAction} onClick={() => handleRotate(document.id, 'left')}>↺ 90°</button>
                <button type="button" className={styles.secondaryAction} onClick={() => handleRotate(document.id, 'right')}>↻ 90°</button>
                <button type="button" className={styles.secondaryAction} onClick={() => handleRotate(document.id, 'reset')}>Rotation zurücksetzen</button>
              </div>
            </div>
          ))}

          {view.fieldGroups.map((group) => (
            <div key={group.fieldCode} className={styles.card}>
              <h3 className={styles.cardTitle}>{group.label}</h3>
              {group.fields.map((field) => (
                <div key={field.id} className={styles.fieldCard}>
                  <DetailRow label="Erkannt" value={field.normalizedValueLabel} />
                  <DetailRow label="Original" value={field.originalText || '—'} />
                  <DetailRow label="Konfidenz" value={field.confidenceClass} />
                  <DetailRow label="Status" value={field.status} />
                  <FormControl
                    id={`field-${field.id}`}
                    type={inputTypeForField(field.inputType) === 'number' ? 'number' : inputTypeForField(field.inputType) === 'date' ? 'date' : 'text'}
                    label={`${group.label} bearbeiten`}
                    inputMode={field.inputType === 'money' ? 'decimal' : undefined}
                    value={fieldEdits[field.id] ?? ''}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setFieldEdits((current) => ({ ...current, [field.id]: event.target.value }))
                    }
                  />
                  <div className={styles.fieldActions}>
                    <button type="button" className={styles.primaryAction} onClick={() => handleSaveCorrection(field.id)}>Korrigieren</button>
                    <button type="button" className={styles.secondaryAction} onClick={() => handleConfirmField(field.id)}>Bestätigen</button>
                    <button type="button" className={styles.secondaryAction} onClick={() => handleResetField(field.id)}>OCR-Wert</button>
                    <button type="button" className={styles.secondaryAction} onClick={() => handleRejectField(field.id)}>Verwerfen</button>
                  </div>
                  {field.candidates.length > 1 ? (
                    <ul className={styles.candidateList}>
                      {field.candidates.map((candidate) => (
                        <li key={candidate.id}>
                          {candidate.normalizedValueLabel} ({candidate.confidenceClass}){' '}
                          <button type="button" className={styles.secondaryAction} onClick={() => handleSelectCandidate(candidate.id)}>
                            Auswählen
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ))}

          {showCostLineForm ? (
            <div className={`${styles.card} ${styles.manualForm}`}>
              <h3 className={styles.cardTitle}>Manuelle Gebührenposition</h3>
              <FormControl type="select" label="Kategorie" value={costLineCategory} onChange={(e) => setCostLineCategory(e.target.value as BillingCostLineCategory)}>
                  {COST_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {BILLING_COST_LINE_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </FormControl>
              <FormControl type="text" label="Bezeichnung" value={costLineLabel} onChange={(e) => setCostLineLabel(e.target.value)} />
              <FormControl type="text" label="Betrag (EUR)" inputMode="decimal" value={costLineAmount} onChange={(e) => setCostLineAmount(e.target.value)} />
              <FormControl type="select" label="Kostenart" value={costLineType} onChange={(e) => setCostLineType(e.target.value as BillingCostLineCostType)}>
                  <option value="recurring">Laufend</option>
                  <option value="one_time">Einmalig</option>
                  <option value="credit">Gutschrift</option>
                  <option value="tax">Steuer</option>
                </FormControl>
              <button type="button" className={styles.primaryAction} onClick={handleAddCostLine}>Position speichern</button>
            </div>
          ) : null}

          {view.costLineItems.length > 0 ? (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Gebührenpositionen</h3>
              {view.costLineItems.map((item) => (
                <div key={item.id} className={styles.fieldCard}>
                  <DetailRow label={item.categoryLabel} value={`${item.label}: ${item.amountLabel}`} />
                  <button type="button" className={styles.secondaryAction} onClick={() => handleRemoveCostLine(item.id)}>Entfernen</button>
                </div>
              ))}
            </div>
          ) : null}

          {showManualPeriod ? (
            <div className={`${styles.card} ${styles.manualForm}`}>
              <h3 className={styles.cardTitle}>Manuelle Periode</h3>
              <FormControl type="date" label="Zeitraum von" value={manualPeriodFrom} onChange={(e) => setManualPeriodFrom(e.target.value)} />
              <FormControl type="date" label="Zeitraum bis" value={manualPeriodTo} onChange={(e) => setManualPeriodTo(e.target.value)} />
              <FormControl type="text" label="Kartenumsatz" value={manualCardVolume} onChange={(e) => setManualCardVolume(e.target.value)} />
              <FormControl type="text" label="Transaktionen" value={manualTransactions} onChange={(e) => setManualTransactions(e.target.value)} />
              <FormControl type="text" label="Fixkosten" value={manualFixedCosts} onChange={(e) => setManualFixedCosts(e.target.value)} />
              <FormControl type="text" label="Terminalkosten" value={manualTerminalCosts} onChange={(e) => setManualTerminalCosts(e.target.value)} />
              <FormControl type="text" label="Variable Gebühren" value={manualTransactionCosts} onChange={(e) => setManualTransactionCosts(e.target.value)} />
              <FormControl type="text" label="Gesamtbetrag" value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} />
              <button type="button" className={styles.primaryAction} onClick={handleManualPeriod}>Periode speichern</button>
            </div>
          ) : null}

          {view.periods.length > 0 ? (
            <div>
              <h3 className={styles.cardTitle}>Abrechnungsperioden</h3>
              <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Zeitraum</th>
                    <th>Umsatz</th>
                    <th>Transaktionen</th>
                    <th>Gesamt</th>
                    <th>Qualität</th>
                  </tr>
                </thead>
                <tbody>
                  {view.periods.map((period) => (
                    <tr key={period.id}>
                      <td>{period.periodLabel}{period.isPreview ? ' (Vorschau)' : ''}</td>
                      <td>{period.cardVolumeLabel}</td>
                      <td>{period.transactionCountLabel}</td>
                      <td>{period.totalLabel}</td>
                      <td>{period.qualityStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : null}

          {view.findings.map((finding) => (
            <p key={finding.code} className={finding.blocking ? styles.statusError : styles.statusWarning}>
              {finding.salesDescription}
            </p>
          ))}

          {view.canConfirm ? (
            <button type="button" className={styles.primaryAction} disabled={isConfirming} onClick={handleConfirmBaseline}>
              Werte übernehmen
            </button>
          ) : view.blockingCount > 0 ? (
            <p className={styles.statusError}>Bestätigung blockiert – {view.blockingCount} offene Prüfpunkte.</p>
          ) : null}
        </>
      )}
    </section>
  );
}

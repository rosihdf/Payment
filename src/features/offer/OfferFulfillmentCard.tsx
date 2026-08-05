import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deriveOperationalActivationSummary,
  OPERATIONAL_ACTIVATION_SUMMARY_LABELS,
} from '../../domain/activation/activationOperationalSummary';
import type { ActivationCase } from '../../domain/activation/activationCase';
import type { Contract } from '../../domain/contract/contract';
import { CONTRACT_STATUS_LABELS } from '../../domain/contract/contractStatus';
import { hasPermission } from '../../domain/permission/permission';
import type { Offer } from '../../domain/offer/offer';
import type { OfferWorkflowEvent } from '../../domain/offer/offerWorkflowEvents';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import { displayDateTime } from '../../utils/format';
import styles from './OfferFulfillmentCard.module.css';

interface OfferFulfillmentCardProps {
  offer: Offer;
  onUpdated?: () => Promise<void>;
}

export function OfferFulfillmentCard({ offer, onUpdated }: OfferFulfillmentCardProps) {
  const { currentUser } = useCurrentUser();
  const { contractService, activationService, offerWorkflowService } = useServices();
  const { showToast } = useToast();
  const [contract, setContract] = useState<Contract | null>(null);
  const [activation, setActivation] = useState<ActivationCase | null>(null);
  const [historicalActivations, setHistoricalActivations] = useState<OfferWorkflowEvent[]>([]);
  const [busy, setBusy] = useState(false);

  const context = useMemo(
    () =>
      currentUser
        ? {
            userId: currentUser.id,
            role: currentUser.role,
            displayName: currentUser.name,
            status: currentUser.status,
          }
        : null,
    [currentUser],
  );

  const reload = useCallback(async () => {
    if (!context) {
      return;
    }
    const linked = await contractService.getByOfferId(offer.id, context);
    setContract(linked);
    if (linked) {
      setActivation(await activationService.getByContractId(linked.id, context));
    } else {
      setActivation(null);
    }
    const summary = await offerWorkflowService.getWorkflowSummary(offer.id);
    setHistoricalActivations(summary.events.filter((event) => event.type === 'activation'));
  }, [activationService, context, contractService, offer.id, offerWorkflowService]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activationSummary = deriveOperationalActivationSummary(activation);
  const canStart =
    Boolean(context) &&
    Boolean(currentUser) &&
    Boolean(contract) &&
    !activation &&
    hasPermission(currentUser?.role ?? 'field_service', 'activations.create') &&
    ['preparation', 'activation'].includes(contract?.status ?? '');

  const handleStart = async () => {
    if (!context || !contract) {
      return;
    }
    setBusy(true);
    const result = await activationService.startFromContract(contract.id, context);
    setBusy(false);
    if (!result.ok) {
      showToast(result.message ?? 'Aktivierung konnte nicht gestartet werden', 'error');
      return;
    }
    showToast(`Aktivierung ${result.value.activationNumber} gestartet`, 'success');
    await reload();
    await onUpdated?.();
  };

  return (
    <section className={styles.card} aria-labelledby="offer-fulfillment-title">
      <h2 id="offer-fulfillment-title" className={styles.title}>
        Vertrag & Aktivierung
      </h2>
      <p className={styles.hint}>
        Operative Aktivierung läuft über den Aktivierungsvorgang. Hier nur Status und Einstieg.
      </p>

      <dl className={styles.summary}>
        <div>
          <dt>Angebot</dt>
          <dd>angenommen</dd>
        </div>
        <div>
          <dt>Vertrag</dt>
          <dd>
            {contract
              ? `${contract.contractNumber} · ${CONTRACT_STATUS_LABELS[contract.status]}`
              : 'ausstehend'}
          </dd>
        </div>
        <div>
          <dt>Aktivierung</dt>
          <dd>
            {OPERATIONAL_ACTIVATION_SUMMARY_LABELS[activationSummary]}
            {activation ? ` · ${activation.activationNumber}` : ''}
          </dd>
        </div>
        {activation ? (
          <>
            <div>
              <dt>Fortschritt</dt>
              <dd>{activation.progressPercent}%</dd>
            </div>
            <div>
              <dt>Nächster Schritt</dt>
              <dd>{activation.nextStep ?? '–'}</dd>
            </div>
          </>
        ) : null}
      </dl>

      <div className={styles.actions}>
        {contract ? (
          <Link className={styles.secondaryAction} to={`/contracts/${contract.id}`}>
            Vertrag öffnen
          </Link>
        ) : null}
        {activation ? (
          <Link className={styles.primaryAction} to={`/activations/${activation.id}`}>
            Aktivierung öffnen
          </Link>
        ) : canStart ? (
          <button
            type="button"
            className={styles.primaryAction}
            disabled={busy}
            onClick={() => void handleStart()}
          >
            Aktivierung starten
          </button>
        ) : null}
      </div>

      {historicalActivations.length > 0 ? (
        <aside className={styles.history} aria-label="Historische Angebotsaktivierung">
          <h3 className={styles.historyTitle}>Historische Angebotsaktivierung</h3>
          <p className={styles.hint}>
            Nur lesbar – keine operative Bearbeitung. Zugeordneter Aktivierungsvorgang:{' '}
            {activation ? activation.activationNumber : 'nicht vorhanden'}
          </p>
          <ul className={styles.historyList}>
            {historicalActivations.map((event) => (
              <li key={event.id}>
                {event.type === 'activation'
                  ? event.status === 'prepared'
                    ? 'Vorbereitung dokumentiert'
                    : 'Aktivierung dokumentiert'
                  : 'Ereignis'}{' '}
                · {displayDateTime(event.createdAt)}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </section>
  );
}

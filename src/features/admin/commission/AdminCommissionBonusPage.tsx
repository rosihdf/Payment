import { useEffect, useState } from 'react';
import { FormControl } from '../../../components/common/FormControl';
import { EmptyState } from '../../../components/feedback/EmptyState';
import {
  COMMISSION_BONUS_STATUS_LABELS,
  COMMISSION_BONUS_TYPE_LABELS,
  type CommissionBonusPayment,
  type CommissionBonusType,
} from '../../../domain/commission/commissionBonusPayment';
import { useServices } from '../../../hooks/useServices';
import { useAdminContext } from '../AdminLayout';
import styles from '../AdminLayout.module.css';
import { AdminCommissionLayout, formatEuro } from './AdminCommissionLayout';

export function AdminCommissionBonusPage() {
  const context = useAdminContext();
  const { commissionAdminService } = useServices();
  const [bonuses, setBonuses] = useState<CommissionBonusPayment[]>([]);
  const [repId, setRepId] = useState('');
  const [amount, setAmount] = useState('');
  const [bonusType, setBonusType] = useState<CommissionBonusType>('bonus');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!context) return;
    const result = await commissionAdminService.getBonusPayments(context);
    if (!('error' in result)) {
      setBonuses(result);
    }
  };

  useEffect(() => {
    void load();
  }, [context]);

  const handleCreate = async () => {
    if (!context || !repId || !title) return;
    const cents = Math.round(Number(amount.replace(',', '.')) * 100);
    const result = await commissionAdminService.createBonusPayment(context, {
      salesRepresentativeId: repId,
      amountCents: cents,
      currency: 'EUR',
      bonusType,
      title,
      description,
      reason,
      periodFrom: null,
      periodUntil: null,
      leadId: null,
      offerId: null,
      contractId: null,
      activationId: null,
      documentReference: null,
      createdByUserId: context.userId,
    });
    setMessage(result.ok ? 'Sonderzahlung angelegt' : `Fehler: ${result.error}`);
    await load();
  };

  return (
    <AdminCommissionLayout title="Provision – Sonderzahlungen">
      <section className={styles.panel}>
        <h2>Neue Sonderzahlung</h2>
        <div className={styles.formGrid}>
          <FormControl type="text" label="Mitarbeiter-ID" value={repId} onChange={(e) => setRepId(e.target.value)} />
          <FormControl type="text" label="Betrag (EUR)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <FormControl
            type="select"
            label="Typ"
            value={bonusType}
            onChange={(e) => setBonusType(e.target.value as CommissionBonusType)}
            options={Object.entries(COMMISSION_BONUS_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <FormControl type="text" label="Bezeichnung" value={title} onChange={(e) => setTitle(e.target.value)} />
          <FormControl type="text" label="Beschreibung" value={description} onChange={(e) => setDescription(e.target.value)} />
          <FormControl type="text" label="Grund" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="button" onClick={() => void handleCreate()}>
            Anlegen
          </button>
        </div>
        {message ? <p role="status">{message}</p> : null}
      </section>

      <section className={styles.panel}>
        <h2>Sonderzahlungen</h2>
        {bonuses.length === 0 ? (
          <EmptyState title="Keine Sonderzahlungen" description="Noch keine Sonderzahlungen erfasst." />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Bezeichnung</th>
                <th>Typ</th>
                <th>Betrag</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {bonuses.map((bonus) => (
                <tr key={bonus.id}>
                  <td>{bonus.title}</td>
                  <td>{COMMISSION_BONUS_TYPE_LABELS[bonus.bonusType]}</td>
                  <td>{formatEuro(bonus.amountCents)}</td>
                  <td>{COMMISSION_BONUS_STATUS_LABELS[bonus.status]}</td>
                  <td>
                    {bonus.status === 'open' ? (
                      <button
                        type="button"
                        onClick={() =>
                          context &&
                          void commissionAdminService
                            .updateBonusStatus(context, bonus.id, 'approved')
                            .then(() => load())
                        }
                      >
                        Freigeben
                      </button>
                    ) : null}
                    {bonus.status === 'approved' ? (
                      <button
                        type="button"
                        onClick={() =>
                          context &&
                          void commissionAdminService
                            .updateBonusStatus(context, bonus.id, 'paid', 'Ausgezahlt')
                            .then(() => load())
                        }
                      >
                        Ausgezahlt
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </AdminCommissionLayout>
  );
}

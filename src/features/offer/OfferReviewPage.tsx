import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import type { PublicOfferView } from '../../domain/offer/publicOfferView';
import styles from './OfferReviewPage.module.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; view: PublicOfferView }
  | { status: 'error'; code: string; message: string }
  | { status: 'submitted'; kind: 'question' | 'change' | 'accept' | 'decline' };

async function fetchPublicOffer(token: string): Promise<Response> {
  return fetch(`/api/public/offers/${encodeURIComponent(token)}`, {
    headers: { Accept: 'application/json' },
  });
}

export function OfferReviewPage() {
  const { token = '' } = useParams();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [questionText, setQuestionText] = useState('');
  const [changeText, setChangeText] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [mode, setMode] = useState<'view' | 'question' | 'change'>('view');
  const [submitting, setSubmitting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchPublicOffer(token);
        const payload = await response.json() as { ok: boolean; view?: PublicOfferView; error?: string; message?: string };
        if (cancelled) return;
        if (!response.ok || !payload.ok || !payload.view) {
          setState({
            status: 'error',
            code: payload.error ?? 'invalid',
            message: payload.message ?? 'Dieser Link ist ungültig.',
          });
          return;
        }
        setCustomerName(payload.view.contactName ?? '');
        setState({ status: 'ready', view: payload.view });
      } catch {
        if (!cancelled) {
          setState({
            status: 'error',
            code: 'technical',
            message: 'Der Service ist vorübergehend nicht erreichbar.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submitQuestion = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch(`/api/public/offers/${encodeURIComponent(token)}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText, customerName, customerEmail }),
      });
      if (response.ok) {
        setState({ status: 'submitted', kind: 'question' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitChange = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch(`/api/public/offers/${encodeURIComponent(token)}/change-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestText: changeText, customerName, customerEmail }),
      });
      if (response.ok) {
        setState({ status: 'submitted', kind: 'change' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitDecision = async (decision: 'accept' | 'decline') => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/public/offers/${encodeURIComponent(token)}/${decision}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, note: '' }),
      });
      if (response.ok) {
        setState({ status: 'submitted', kind: decision });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openPdf = async () => {
    setPdfBusy(true);
    try {
      const response = await fetch(`/api/public/offers/${encodeURIComponent(token)}/pdf`);
      const payload = (await response.json()) as {
        ok: boolean;
        documentSnapshot?: unknown;
      };
      if (!payload.ok || !payload.documentSnapshot) {
        return;
      }
      const { renderOfferPdfBlob } = await import('../../services/offerPdfRenderer');
      const blob = renderOfferPdfBlob(
        payload.documentSnapshot as Parameters<typeof renderOfferPdfBlob>[0],
        { isPreview: false },
      );
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.brand}>AMRtech</p>
        <h1 className={styles.title}>Ihr Angebot</h1>
      </header>

      {state.status === 'loading' ? <p>Lade Angebot…</p> : null}

      {state.status === 'error' ? (
        <section className={styles.errorPanel} role="alert">
          <h2>Link nicht verfügbar</h2>
          <p>{state.message}</p>
        </section>
      ) : null}

      {state.status === 'submitted' ? (
        <section className={styles.successPanel} role="status">
          <h2>Vielen Dank</h2>
          <p>
            {state.kind === 'question'
              ? 'Ihre Rückfrage wurde übermittelt.'
              : state.kind === 'change'
                ? 'Ihr Änderungswunsch wurde übermittelt.'
                : state.kind === 'accept'
                  ? 'Sie haben das Angebot angenommen. Wir melden uns bei Ihnen.'
                  : 'Sie haben das Angebot abgelehnt.'}
          </p>
        </section>
      ) : null}

      {state.status === 'ready' ? (
        <>
          <section className={styles.panel}>
            <p className={styles.status}>Zur Prüfung bereitgestellt</p>
            <p className={styles.hint}>
              Link gültig bis {new Date(state.view.linkValidUntil).toLocaleDateString('de-DE')}.
            </p>
            <dl className={styles.grid}>
              <div><dt>Ansprechpartner</dt><dd>{state.view.salesContactName}</dd></div>
              <div><dt>Angebotsnummer</dt><dd>{state.view.offerNumber}</dd></div>
              <div><dt>Kunde</dt><dd>{state.view.companyName}</dd></div>
              <div><dt>Erstellt am</dt><dd>{new Date(state.view.versionCreatedAt).toLocaleDateString('de-DE')}</dd></div>
            </dl>
          </section>

          <section className={styles.panel}>
            <h2>Ihr Angebot im Überblick</h2>
            <dl className={styles.grid}>
              <div><dt>Lösung</dt><dd>{state.view.tariffName ?? '–'}</dd></div>
              {state.view.termMonths ? (
                <div><dt>Vertragslaufzeit</dt><dd>{state.view.termMonths} Monate</dd></div>
              ) : null}
              <div><dt>Einmalige Kosten</dt><dd>{state.view.oneTimeTotalLabel}</dd></div>
              <div><dt>Monatliche Kosten</dt><dd>{state.view.monthlyTotalLabel}</dd></div>
              <div><dt>Variable Gebühren</dt><dd>{state.view.transactionCostHint}</dd></div>
            </dl>
            {state.view.hasPdf ? (
              <button
                type="button"
                className={styles.primaryButton}
                disabled={pdfBusy}
                onClick={() => void openPdf()}
              >
                PDF öffnen
              </button>
            ) : null}
          </section>

          <section className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={submitting}
              onClick={() => void submitDecision('accept')}
            >
              Angebot annehmen
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={submitting}
              onClick={() => void submitDecision('decline')}
            >
              Angebot ablehnen
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => setMode('question')}>
              Rückfrage senden
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => setMode('change')}>
              Änderung anfragen
            </button>
          </section>

          {mode === 'question' ? (
            <form className={styles.form} onSubmit={(event) => void submitQuestion(event)}>
              <h2>Rückfrage</h2>
              <label>
                Name (optional)
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              </label>
              <label>
                E-Mail (optional)
                <input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
              </label>
              <label>
                Ihre Frage
                <textarea required value={questionText} onChange={(event) => setQuestionText(event.target.value)} rows={5} />
              </label>
              <button type="submit" className={styles.primaryButton} disabled={submitting}>Absenden</button>
            </form>
          ) : null}

          {mode === 'change' ? (
            <form className={styles.form} onSubmit={(event) => void submitChange(event)}>
              <h2>Änderungswunsch</h2>
              <label>
                Name (optional)
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              </label>
              <label>
                E-Mail (optional)
                <input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
              </label>
              <label>
                Beschreibung
                <textarea required value={changeText} onChange={(event) => setChangeText(event.target.value)} rows={5} />
              </label>
              <button type="submit" className={styles.primaryButton} disabled={submitting}>Absenden</button>
            </form>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

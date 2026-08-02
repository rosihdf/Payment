import { useCallback, useEffect, useState } from 'react';
import type { OfferChangeRequest, OfferChangeRequestStatus } from '../../domain/offer/offerChangeRequest';
import { OFFER_CHANGE_REQUEST_STATUS_LABELS } from '../../domain/offer/offerChangeRequest';
import type { OfferCustomerQuestion } from '../../domain/offer/offerCustomerQuestion';
import { OFFER_CUSTOMER_QUESTION_STATUS_LABELS } from '../../domain/offer/offerCustomerQuestion';
import type { Offer } from '../../domain/offer/offer';
import { useServices } from '../../hooks/useServices';
import type { OfferUserContext } from '../../services/offerService';
import { formatDateTime } from '../../utils/format';
import styles from './OfferCustomerFeedbackSection.module.css';

interface OfferCustomerFeedbackSectionProps {
  offer: Offer;
  userContext: OfferUserContext;
  onUpdated?: () => void;
}

export function OfferCustomerFeedbackSection({
  offer,
  userContext,
  onUpdated,
}: OfferCustomerFeedbackSectionProps) {
  const { offerCustomerQuestionService, offerChangeRequestService } = useServices();
  const [questions, setQuestions] = useState<OfferCustomerQuestion[]>([]);
  const [changeRequests, setChangeRequests] = useState<OfferChangeRequest[]>([]);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [nextQuestions, nextRequests] = await Promise.all([
      offerCustomerQuestionService.getQuestionsByOfferId(offer.id),
      offerChangeRequestService.getChangeRequestsByOfferId(offer.id),
    ]);
    setQuestions(nextQuestions.sort((left, right) => right.askedAt.localeCompare(left.askedAt)));
    setChangeRequests(nextRequests.sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
    setLoading(false);
  }, [offer.id, offerChangeRequestService, offerCustomerQuestionService]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAnswer = async (questionId: string) => {
    const answerText = answerDrafts[questionId]?.trim();
    if (!answerText) return;
    const result = await offerCustomerQuestionService.answerQuestion(questionId, answerText, userContext);
    if (result.ok) {
      setAnswerDrafts((current) => ({ ...current, [questionId]: '' }));
      await load();
      onUpdated?.();
    }
  };

  const handleQuestionStatus = async (questionId: string, status: OfferCustomerQuestion['status']) => {
    await offerCustomerQuestionService.updateStatus(questionId, status, userContext);
    await load();
    onUpdated?.();
  };

  const handleChangeStatus = async (requestId: string, status: OfferChangeRequestStatus) => {
    await offerChangeRequestService.updateStatus(requestId, status, userContext);
    await load();
    onUpdated?.();
  };

  if (loading) {
    return <p className={styles.hint}>Kundenfeedback wird geladen…</p>;
  }

  if (questions.length === 0 && changeRequests.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="offer-customer-feedback-title">
      <h2 id="offer-customer-feedback-title" className={styles.title}>
        Kundenfeedback
      </h2>
      <p className={styles.subtitle}>Rückfragen und Änderungswünsche aus der Kundenansicht.</p>

      {questions.length > 0 ? (
        <>
          <h3 className={styles.subtitle}>Rückfragen</h3>
          <ul className={styles.list}>
            {questions.map((question) => (
              <li key={question.id} className={styles.card}>
                <p className={styles.meta}>
                  <span>{formatDateTime(question.askedAt)}</span>
                  <span>{OFFER_CUSTOMER_QUESTION_STATUS_LABELS[question.status]}</span>
                  {question.customerName ? <span>{question.customerName}</span> : null}
                </p>
                <p className={styles.text}>{question.questionText}</p>
                {question.answerText ? (
                  <div className={styles.answer}>
                    <strong>Antwort</strong>
                    <p className={styles.text}>{question.answerText}</p>
                    {question.answeredAt ? (
                      <p className={styles.meta}>{formatDateTime(question.answeredAt)}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className={styles.form}>
                    <label>
                      Antwort
                      <textarea
                        rows={3}
                        value={answerDrafts[question.id] ?? ''}
                        onChange={(event) =>
                          setAnswerDrafts((current) => ({
                            ...current,
                            [question.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.primaryAction}
                        onClick={() => void handleAnswer(question.id)}
                      >
                        Antwort speichern
                      </button>
                    </div>
                  </div>
                )}
                {question.status !== 'closed' ? (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      onClick={() => void handleQuestionStatus(question.id, 'closed')}
                    >
                      Schließen
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {changeRequests.length > 0 ? (
        <>
          <h3 className={styles.subtitle}>Änderungswünsche</h3>
          <ul className={styles.list}>
            {changeRequests.map((request) => (
              <li key={request.id} className={styles.card}>
                <p className={styles.meta}>
                  <span>{formatDateTime(request.createdAt)}</span>
                  <span>{OFFER_CHANGE_REQUEST_STATUS_LABELS[request.status]}</span>
                  {request.customerName ? <span>{request.customerName}</span> : null}
                </p>
                <p className={styles.text}>{request.requestText}</p>
                <div className={styles.form}>
                  <label>
                    Status
                    <select
                      value={request.status}
                      onChange={(event) =>
                        void handleChangeStatus(request.id, event.target.value as OfferChangeRequestStatus)
                      }
                    >
                      {(Object.keys(OFFER_CHANGE_REQUEST_STATUS_LABELS) as OfferChangeRequestStatus[]).map(
                        (status) => (
                          <option key={status} value={status}>
                            {OFFER_CHANGE_REQUEST_STATUS_LABELS[status]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

import { normalizeOfferCustomerQuestions } from '../../domain/offer/normalizeOfferCustomerQuestion';
import type { OfferCustomerQuestion } from '../../domain/offer/offerCustomerQuestion';
import type { OfferCustomerQuestionRepository } from '../interfaces/OfferCustomerQuestionRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'offer_customer_questions';

function questionToRow(question: OfferCustomerQuestion): Record<string, unknown> {
  return {
    id: question.id,
    offer_id: question.offerId,
    offer_version_id: question.offerVersionId,
    share_id: question.shareId,
    question_text: question.questionText,
    customer_name: question.customerName,
    customer_email: question.customerEmail,
    status: question.status,
    answer_text: question.answerText,
    answered_by_user_id: question.answeredByUserId,
    asked_at: question.askedAt,
    answered_at: question.answeredAt,
    data: question,
    created_at: question.createdAt,
    updated_at: question.updatedAt,
  };
}

function rowToQuestion(row: JsonTableRow): OfferCustomerQuestion {
  const normalized = normalizeOfferCustomerQuestions([
    rowData(row, {
      id: row.id,
      offerId: row.offer_id,
      offerVersionId: row.offer_version_id,
      shareId: row.share_id,
      questionText: row.question_text,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      status: row.status,
      answerText: row.answer_text,
      answeredByUserId: row.answered_by_user_id,
      askedAt: row.asked_at,
      answeredAt: row.answered_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  ])[0];
  if (!normalized) {
    throw new Error(`OfferCustomerQuestion konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseOfferCustomerQuestionRepository implements OfferCustomerQuestionRepository {
  async getAll(): Promise<OfferCustomerQuestion[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeOfferCustomerQuestions(rows.map((row) => rowToQuestion(row)));
  }

  async getById(id: string): Promise<OfferCustomerQuestion | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToQuestion(row) : null;
  }

  async getByOfferId(offerId: string): Promise<OfferCustomerQuestion[]> {
    const rows = await sbSelectWhere(TABLE, 'offer_id', offerId);
    return normalizeOfferCustomerQuestions(rows.map((row) => rowToQuestion(row)));
  }

  async getByOfferVersionId(offerVersionId: string): Promise<OfferCustomerQuestion[]> {
    const rows = await sbSelectWhere(TABLE, 'offer_version_id', offerVersionId);
    return normalizeOfferCustomerQuestions(rows.map((row) => rowToQuestion(row)));
  }

  async create(question: OfferCustomerQuestion): Promise<OfferCustomerQuestion> {
    const existing = await this.getById(question.id);
    if (existing) {
      throw new Error(`OfferCustomerQuestion already exists: ${question.id}`);
    }
    const row = await sbInsert(TABLE, questionToRow(question));
    return rowToQuestion(row);
  }

  async update(question: OfferCustomerQuestion): Promise<OfferCustomerQuestion> {
    const existing = await this.getById(question.id);
    if (!existing) {
      throw new Error(`OfferCustomerQuestion not found: ${question.id}`);
    }
    const row = await sbUpdate(TABLE, question.id, questionToRow(question));
    return rowToQuestion(row);
  }
}

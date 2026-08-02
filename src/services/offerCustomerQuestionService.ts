import {
  MAX_CUSTOMER_QUESTION_LENGTH,
  sanitizeCustomerText,
  type OfferCustomerQuestion,
  type OfferCustomerQuestionStatus,
} from '../domain/offer/offerCustomerQuestion';
import type { OfferCustomerQuestionRepository } from '../repositories/interfaces/OfferCustomerQuestionRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import { generateId, nowIso } from '../utils/id';
import type { OfferUserContext } from './offerService';
import type { SalesActivityService } from './salesActivityService';

export interface SubmitCustomerQuestionInput {
  offerId: string;
  offerVersionId: string;
  shareId: string | null;
  questionText: string;
  customerName?: string | null;
  customerEmail?: string | null;
}

export type SubmitCustomerQuestionResult =
  | { ok: true; question: OfferCustomerQuestion }
  | { ok: false; error: 'validation' | 'not_found'; issues?: string[] };

export class OfferCustomerQuestionService {
  private activityService: SalesActivityService | null = null;
  private readonly questionRepository: OfferCustomerQuestionRepository;
  private readonly offerRepository: OfferRepository;

  constructor(
    questionRepository: OfferCustomerQuestionRepository,
    offerRepository: OfferRepository,
  ) {
    this.questionRepository = questionRepository;
    this.offerRepository = offerRepository;
  }

  setSalesActivityService(service: SalesActivityService): void {
    this.activityService = service;
  }

  async getQuestionsByOfferId(offerId: string): Promise<OfferCustomerQuestion[]> {
    return this.questionRepository.getByOfferId(offerId);
  }

  async getOpenQuestionsByOfferId(offerId: string): Promise<OfferCustomerQuestion[]> {
    const questions = await this.questionRepository.getByOfferId(offerId);
    return questions.filter((entry) => entry.status === 'open');
  }

  validateQuestionInput(input: SubmitCustomerQuestionInput): string[] {
    const text = sanitizeCustomerText(input.questionText);
    const issues: string[] = [];
    if (!text) {
      issues.push('Bitte geben Sie eine Rückfrage ein.');
    }
    if (text.length > MAX_CUSTOMER_QUESTION_LENGTH) {
      issues.push(`Die Rückfrage darf maximal ${MAX_CUSTOMER_QUESTION_LENGTH} Zeichen enthalten.`);
    }
    return issues;
  }

  async submitQuestion(input: SubmitCustomerQuestionInput): Promise<SubmitCustomerQuestionResult> {
    const issues = this.validateQuestionInput(input);
    if (issues.length > 0) {
      return { ok: false, error: 'validation', issues };
    }

    const offer = await this.offerRepository.getById(input.offerId);
    if (!offer) {
      return { ok: false, error: 'not_found' };
    }

    const timestamp = nowIso();
    const question: OfferCustomerQuestion = {
      id: generateId('offer_question'),
      offerId: input.offerId,
      offerVersionId: input.offerVersionId,
      shareId: input.shareId,
      questionText: sanitizeCustomerText(input.questionText),
      customerName: input.customerName?.trim() || null,
      customerEmail: input.customerEmail?.trim() || null,
      status: 'open',
      answerText: null,
      answeredByUserId: null,
      askedAt: timestamp,
      answeredAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.questionRepository.create(question);
    await this.recordActivity(null, {
      title: 'Kunde hat Rückfrage gestellt',
      description: question.questionText.slice(0, 160),
      offerId: offer.id,
      leadId: offer.leadId,
      sourceKey: `offer_question_submitted:${question.id}`,
    });
    return { ok: true, question };
  }

  async answerQuestion(
    questionId: string,
    answerText: string,
    context: OfferUserContext,
  ): Promise<{ ok: true; question: OfferCustomerQuestion } | { ok: false; error: 'not_found' | 'validation' }> {
    const question = await this.questionRepository.getById(questionId);
    if (!question) {
      return { ok: false, error: 'not_found' };
    }
    const normalized = sanitizeCustomerText(answerText);
    if (!normalized) {
      return { ok: false, error: 'validation' };
    }

    const timestamp = nowIso();
    const updated: OfferCustomerQuestion = {
      ...question,
      status: 'answered',
      answerText: normalized,
      answeredByUserId: context.userId,
      answeredAt: timestamp,
      updatedAt: timestamp,
    };
    await this.questionRepository.update(updated);

    const offer = await this.offerRepository.getById(question.offerId);
    await this.recordActivity(context, {
      title: 'Rückfrage beantwortet',
      description: normalized.slice(0, 160),
      offerId: question.offerId,
      leadId: offer?.leadId ?? null,
      sourceKey: `offer_question_answered:${question.id}`,
    });

    return { ok: true, question: updated };
  }

  async updateStatus(
    questionId: string,
    status: OfferCustomerQuestionStatus,
    context: OfferUserContext,
  ): Promise<{ ok: true; question: OfferCustomerQuestion } | { ok: false; error: 'not_found' }> {
    const question = await this.questionRepository.getById(questionId);
    if (!question) {
      return { ok: false, error: 'not_found' };
    }
    const updated: OfferCustomerQuestion = {
      ...question,
      status,
      updatedAt: nowIso(),
    };
    await this.questionRepository.update(updated);
    if (status === 'closed') {
      const offer = await this.offerRepository.getById(question.offerId);
      await this.recordActivity(context, {
        title: 'Rückfrage geschlossen',
        description: 'Eine Kundenrückfrage wurde geschlossen.',
        offerId: question.offerId,
        leadId: offer?.leadId ?? null,
        sourceKey: `offer_question_closed:${question.id}`,
      });
    }
    return { ok: true, question: updated };
  }

  private async recordActivity(
    context: OfferUserContext | null,
    input: {
      title: string;
      description: string;
      offerId: string;
      leadId: string | null;
      sourceKey: string;
    },
  ): Promise<void> {
    if (!this.activityService || !context) return;
    await this.activityService.recordSystemActivity(
      {
        type: 'status_change',
        title: input.title,
        description: input.description,
        offerId: input.offerId,
        leadId: input.leadId,
        sourceKey: input.sourceKey,
      },
      context,
    );
  }
}

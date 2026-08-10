import type { Offer } from '../../domain/offer/offer';
import {
  toOfferListItem,
  type OfferListItem,
  type OfferListQuery,
} from '../../domain/offer/offerListItem';
import { normalizeOffer, normalizeOffers } from '../../domain/offer/normalizeOffer';
import { migrateOfferStorageIfNeeded } from '../../services/offerStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import { OfferConflictError } from '../errors/OfferConflictError';
import { OfferNotFoundError } from '../errors/OfferNotFoundError';
import type { OfferRepository } from '../interfaces/OfferRepository';

export class LocalOfferRepository implements OfferRepository {
  private readOffers(): Offer[] {
    migrateOfferStorageIfNeeded();
    const rawOffers = readStorageItem<unknown[]>(STORAGE_KEYS.offers) ?? [];
    return normalizeOffers(rawOffers);
  }

  async getAll(): Promise<Offer[]> {
    return this.readOffers();
  }

  async listItems(query: OfferListQuery = {}): Promise<OfferListItem[]> {
    let offers = this.readOffers();
    if (query.leadId) {
      offers = offers.filter((offer) => offer.leadId === query.leadId);
    }
    if (query.offset) {
      offers = offers.slice(query.offset);
    }
    if (query.limit) {
      offers = offers.slice(0, query.limit);
    }
    return offers.map(toOfferListItem);
  }

  async getByLeadId(leadId: string): Promise<Offer[]> {
    return this.readOffers().filter((offer) => offer.leadId === leadId);
  }

  async getById(id: string): Promise<Offer | null> {
    return this.readOffers().find((offer) => offer.id === id) ?? null;
  }

  async create(offer: Offer): Promise<Offer> {
    const offers = this.readOffers();
    const normalizedOffer = normalizeOffer(offer);

    if (offers.some((item) => item.id === normalizedOffer.id)) {
      throw new OfferConflictError('duplicate_id', `Offer with id ${normalizedOffer.id} already exists`);
    }

    if (
      offers.some((item) => item.offerNumber === normalizedOffer.offerNumber)
    ) {
      throw new OfferConflictError(
        'duplicate_offer_number',
        `Offer number ${normalizedOffer.offerNumber} already exists`,
      );
    }

    writeStorageItem(STORAGE_KEYS.offers, [...offers, normalizedOffer]);
    return { ...normalizedOffer };
  }

  async update(offer: Offer): Promise<Offer> {
    const offers = this.readOffers();
    const index = offers.findIndex((item) => item.id === offer.id);

    if (index === -1) {
      throw new OfferNotFoundError(offer.id);
    }

    const normalizedOffer = normalizeOffer(offer);

    if (
      offers.some(
        (item, itemIndex) =>
          itemIndex !== index && item.offerNumber === normalizedOffer.offerNumber,
      )
    ) {
      throw new OfferConflictError(
        'duplicate_offer_number',
        `Offer number ${normalizedOffer.offerNumber} already exists`,
      );
    }

    const updatedOffers = [...offers];
    updatedOffers[index] = normalizedOffer;
    writeStorageItem(STORAGE_KEYS.offers, updatedOffers);
    return { ...normalizedOffer };
  }

  async delete(id: string): Promise<void> {
    const offers = this.readOffers();
    const next = offers.filter((item) => item.id !== id);
    if (next.length === offers.length) {
      throw new OfferNotFoundError(id);
    }
    writeStorageItem(STORAGE_KEYS.offers, next);
  }
}

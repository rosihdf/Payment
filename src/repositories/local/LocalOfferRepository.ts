import type { Offer } from '../../domain/offer/offer';
import { normalizeOffer, normalizeOffers } from '../../domain/offer/normalizeOffer';
import { migrateOfferStorageIfNeeded } from '../../services/offerStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import { OfferConflictError } from '../errors/OfferConflictError';
import { OfferNotFoundError } from '../errors/OfferNotFoundError';
import type { OfferRepository } from '../interfaces/OfferRepository';

export class LocalOfferRepository implements OfferRepository {
  async getAll(): Promise<Offer[]> {
    migrateOfferStorageIfNeeded();
    const rawOffers = readStorageItem<unknown[]>(STORAGE_KEYS.offers) ?? [];
    return normalizeOffers(rawOffers);
  }

  async getById(id: string): Promise<Offer | null> {
    const offers = await this.getAll();
    return offers.find((offer) => offer.id === id) ?? null;
  }

  async create(offer: Offer): Promise<Offer> {
    const offers = await this.getAll();
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
    const offers = await this.getAll();
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
}

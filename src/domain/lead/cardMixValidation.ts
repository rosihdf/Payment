import type { CardMix } from './lead';

export interface CardMixValidationResult {
  isValid: boolean;
  sum: number;
  message: string;
}

export function validateCardMix(cardMix: CardMix): CardMixValidationResult {
  const values = [
    cardMix.girocardPercent,
    cardMix.debitPercent,
    cardMix.creditPercent,
    cardMix.otherPercent,
  ];

  if (values.some((value) => value < 0 || value > 100)) {
    return {
      isValid: false,
      sum: values.reduce((total, value) => total + value, 0),
      message: 'Kartenanteile müssen zwischen 0 und 100 % liegen.',
    };
  }

  const sum = values.reduce((total, value) => total + value, 0);
  const hasPositiveValue = values.some((value) => value > 0);

  if (!hasPositiveValue) {
    return {
      isValid: true,
      sum,
      message: 'Summe: 0 % — vollständig',
    };
  }

  if (sum === 100) {
    return {
      isValid: true,
      sum,
      message: 'Summe: 100 % — vollständig',
    };
  }

  return {
    isValid: false,
    sum,
    message: 'Die Kartenanteile müssen zusammen 100 % ergeben.',
  };
}

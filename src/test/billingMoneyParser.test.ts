import { describe, expect, it } from 'vitest';
import { parseIntegerText, parseMoneyText, parsePercentText } from '../domain/billingImportEngine/billingMoneyParser';

describe('billingMoneyParser', () => {
  it('parst deutsche Geldbeträge', () => {
    expect(parseMoneyText('1.234,56 €')?.amountCents).toBe(123456);
    expect(parseMoneyText('0,039 €')?.amountCents).toBe(4);
    expect(parseMoneyText('0,014 €')?.amountCents).toBe(1);
    expect(parseMoneyText('-25,00 €')?.amountCents).toBe(-2500);
  });

  it('parst internationale Geldbeträge', () => {
    expect(parseMoneyText('1,234.56 EUR')?.amountCents).toBe(123456);
    expect(parseMoneyText('1,234.56 EUR')?.currency).toBe('EUR');
  });

  it('erkennt Gutschriften', () => {
    expect(parseMoneyText('Gutschrift 25,00 €')?.isCredit).toBe(true);
    expect(parseMoneyText('Gutschrift 25,00 €')?.amountCents).toBe(-2500);
    expect(parseMoneyText('25,00-')?.amountCents).toBe(-2500);
  });

  it('parst Prozentwerte', () => {
    expect(parsePercentText('0,30 %')?.percentTenthsOfBasisPoint).toBe(300);
  });

  it('parst Ganzzahlen mit Tausendertrennzeichen', () => {
    expect(parseIntegerText('1.234')).toBe(1234);
  });

  it('liefert null bei ungültigem Format', () => {
    expect(parseMoneyText('kein Betrag')).toBeNull();
  });
});

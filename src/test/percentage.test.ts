import { describe, expect, it } from 'vitest';
import {
  basisPointsToPercent,
  formatBasisPointsToPercent,
  isValidBasisPoints,
  parsePercentToBasisPoints,
  percentToBasisPoints,
} from '../utils/percentage';
import { formatCardRate } from '../utils/formatTariff';

describe('Percentage utilities', () => {
  it('converts percent to basis points correctly', () => {
    expect(percentToBasisPoints(0.25)).toBe(25);
    expect(percentToBasisPoints(1.19)).toBe(119);
    expect(percentToBasisPoints(2.5)).toBe(250);
  });

  it('converts basis points to percent correctly', () => {
    expect(basisPointsToPercent(25)).toBe(0.25);
    expect(basisPointsToPercent(119)).toBe(1.19);
    expect(basisPointsToPercent(250)).toBe(2.5);
  });

  it('formats basis points as German percent text', () => {
    expect(formatBasisPointsToPercent(25)).toBe('0,25 %');
    expect(formatBasisPointsToPercent(119)).toBe('1,19 %');
  });

  it('parses German comma percent input', () => {
    expect(parsePercentToBasisPoints('0,25')).toBe(25);
    expect(parsePercentToBasisPoints('1,19 %')).toBe(119);
    expect(parsePercentToBasisPoints('2,50')).toBe(250);
  });

  it('rejects invalid percent values', () => {
    expect(parsePercentToBasisPoints('-1')).toBeNull();
    expect(parsePercentToBasisPoints('101')).toBeNull();
    expect(parsePercentToBasisPoints('abc')).toBeNull();
  });

  it('validates basis points range', () => {
    expect(isValidBasisPoints(0)).toBe(true);
    expect(isValidBasisPoints(10000)).toBe(true);
    expect(isValidBasisPoints(-1)).toBe(false);
    expect(isValidBasisPoints(10001)).toBe(false);
  });
});

describe('Card rate formatting', () => {
  it('formats combined percent and fixed fee', () => {
    expect(formatCardRate({ percentageBasisPoints: 25, fixedFeeCents: 9 }).replace(/\u00a0/g, ' ')).toBe(
      '0,25 % + 0,09 €',
    );
  });

  it('formats percent only', () => {
    expect(formatCardRate({ percentageBasisPoints: 119, fixedFeeCents: 0 })).toBe('1,19 %');
  });

  it('formats fixed fee only', () => {
    expect(formatCardRate({ percentageBasisPoints: 0, fixedFeeCents: 9 }).replace(/\u00a0/g, ' ')).toBe(
      '0,09 €',
    );
  });

  it('shows kostenfrei when both values are zero', () => {
    expect(formatCardRate({ percentageBasisPoints: 0, fixedFeeCents: 0 })).toBe('Kostenfrei');
  });
});

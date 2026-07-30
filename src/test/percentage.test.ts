import { describe, expect, it } from 'vitest';
import {
  basisPointsToPercent,
  formatBasisPointsToPercent,
  formatTenthsOfBasisPointToPercent,
  isValidBasisPoints,
  isValidTenthsOfBasisPoint,
  parsePercentToBasisPoints,
  parsePercentToTenthsOfBasisPoint,
  percentToBasisPoints,
  percentToTenthsOfBasisPoint,
} from '../utils/percentage';
import { formatCardRate } from '../utils/formatTariff';
import { percentageOfCentsFromTenthsOfBasisPoint } from '../utils/percentageAmount';

describe('Percentage utilities', () => {
  it('converts percent to basis points correctly', () => {
    expect(percentToBasisPoints(0.25)).toBe(25);
    expect(percentToBasisPoints(1.19)).toBe(119);
    expect(percentToBasisPoints(2.5)).toBe(250);
  });

  it('converts percent to tenths of basis point correctly', () => {
    expect(percentToTenthsOfBasisPoint(0.249)).toBe(249);
    expect(percentToTenthsOfBasisPoint(0.89)).toBe(890);
    expect(percentToTenthsOfBasisPoint(0.99)).toBe(990);
    expect(percentToTenthsOfBasisPoint(1.19)).toBe(1190);
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

  it('formats tenths of basis points with up to three decimals', () => {
    expect(formatTenthsOfBasisPointToPercent(249)).toBe('0,249 %');
    expect(formatTenthsOfBasisPointToPercent(890)).toBe('0,89 %');
    expect(formatTenthsOfBasisPointToPercent(1190)).toBe('1,19 %');
    expect(formatTenthsOfBasisPointToPercent(990)).toBe('0,99 %');
  });

  it('parses German comma percent input to basis points', () => {
    expect(parsePercentToBasisPoints('0,25')).toBe(25);
    expect(parsePercentToBasisPoints('1,19 %')).toBe(119);
    expect(parsePercentToBasisPoints('2,50')).toBe(250);
  });

  it('parses German comma percent input to tenths of basis points', () => {
    expect(parsePercentToTenthsOfBasisPoint('0,249')).toBe(249);
    expect(parsePercentToTenthsOfBasisPoint('0,890')).toBe(890);
    expect(parsePercentToTenthsOfBasisPoint('1,190 %')).toBe(1190);
  });

  it('rejects invalid percent values', () => {
    expect(parsePercentToBasisPoints('-1')).toBeNull();
    expect(parsePercentToBasisPoints('101')).toBeNull();
    expect(parsePercentToBasisPoints('abc')).toBeNull();
    expect(parsePercentToTenthsOfBasisPoint('-1')).toBeNull();
    expect(parsePercentToTenthsOfBasisPoint('101')).toBeNull();
  });

  it('validates basis points range', () => {
    expect(isValidBasisPoints(0)).toBe(true);
    expect(isValidBasisPoints(10000)).toBe(true);
    expect(isValidBasisPoints(-1)).toBe(false);
    expect(isValidBasisPoints(10001)).toBe(false);
  });

  it('validates tenths of basis points range', () => {
    expect(isValidTenthsOfBasisPoint(249)).toBe(true);
    expect(isValidTenthsOfBasisPoint(100_000)).toBe(true);
    expect(isValidTenthsOfBasisPoint(-1)).toBe(false);
    expect(isValidTenthsOfBasisPoint(100_001)).toBe(false);
  });

  it('calculates 0,249 % reference amount exactly', () => {
    expect(percentageOfCentsFromTenthsOfBasisPoint(1_400_000, 249)).toBe(3_486);
  });
});

describe('Card rate formatting', () => {
  it('formats combined percent and fixed fee', () => {
    expect(
      formatCardRate({ percentageTenthsOfBasisPoint: 250, fixedFeeTenthsOfCent: 90 }).replace(
        /\u00a0/g,
        ' ',
      ),
    ).toBe('0,25 % + 0,090 €');
  });

  it('formats percent only', () => {
    expect(formatCardRate({ percentageTenthsOfBasisPoint: 1190, fixedFeeTenthsOfCent: 0 })).toBe(
      '1,19 %',
    );
  });

  it('formats 0,249 % exactly', () => {
    expect(formatCardRate({ percentageTenthsOfBasisPoint: 249, fixedFeeTenthsOfCent: 0 })).toBe(
      '0,249 %',
    );
  });

  it('formats fixed fee only', () => {
    expect(
      formatCardRate({ percentageTenthsOfBasisPoint: 0, fixedFeeTenthsOfCent: 90 }).replace(
        /\u00a0/g,
        ' ',
      ),
    ).toBe('0,090 €');
  });

  it('shows kostenfrei when both values are zero', () => {
    expect(formatCardRate({ percentageTenthsOfBasisPoint: 0, fixedFeeTenthsOfCent: 0 })).toBe(
      'Kostenfrei',
    );
  });
});

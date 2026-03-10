import { describe, it, expect } from '@jest/globals';
import { calculateIndicators, DataPoint } from '../indicators';

describe('calculateIndicators', () => {
  it('should return empty array if input is empty', () => {
    expect(calculateIndicators([])).toEqual([]);
  });

  it('should calculate Bollinger Bands correctly for 20+ points', () => {
    const mockData: DataPoint[] = Array.from({ length: 25 }, (_, i) => ({
      date: `2023-01-${i + 1}`,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 100 + i,
      volume: 1000,
    }));

    const result = calculateIndicators(mockData);

    // Initial 19 items should have null/false indicators
    expect(result[0].MA20).toBeNull();
    expect(result[18].MA20).toBeNull();

    // 20th item and beyond should have indicators
    expect(result[19].MA20).toBeCloseTo(109.5);
    expect(result[19].Upper).toBeGreaterThan(result[19].MA20!);
    expect(result[19].Lower).toBeLessThan(result[19].MA20!);
  });

  it('should calculate RSI correctly', () => {
    const mockData: DataPoint[] = Array.from({ length: 20 }, (_, i) => ({
      date: `2023-01-${i + 1}`,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 100 + i, // Constantly increasing
      volume: 1000,
    }));

    const result = calculateIndicators(mockData);

    // RSI should be high for constantly increasing price
    expect(result[14].RSI).toBe(100);
    expect(result[19].RSI).toBeCloseTo(100);
  });

  it('should detect volume spikes', () => {
    const mockData: DataPoint[] = Array.from({ length: 25 }, (_, i) => ({
      date: `2023-01-${i + 1}`,
      open: 100,
      high: 105,
      low: 95,
      close: 100,
      volume: i === 24 ? 10000 : 1000, // Spike on last day
    }));

    const result = calculateIndicators(mockData);

    expect(result[23].Vol_Spike).toBe(false);
    expect(result[24].Vol_Spike).toBe(true);
  });
});

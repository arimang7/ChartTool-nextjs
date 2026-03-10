export interface DataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  MA20?: number | null;
  STD20?: number | null;
  Upper?: number | null;
  Lower?: number | null;
  RSI?: number | null;
  Vol_MA20?: number | null;
  Vol_Spike?: boolean;
}

export function calculateIndicators(data: DataPoint[]): DataPoint[] {
  if (data.length === 0) return data;

  const result = [...data];

  // Helper for averages
  const getAverage = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  // Helper for standard deviation
  const getStdDev = (arr: number[], mean: number) => {
    const variance = arr.reduce((a, b) => a + Math.pow(b - Math.abs(mean), 2), 0) / arr.length;
    return Math.sqrt(variance);
  };

  // Bollinger Bands & Volume MA20
  for (let i = 0; i < result.length; i++) {
    if (i >= 19) {
      const windowClose = result.slice(i - 19, i + 1).map((d) => d.close);
      const windowVol = result.slice(i - 19, i + 1).map((d) => d.volume);

      const ma20 = getAverage(windowClose);
      const std20 = getStdDev(windowClose, ma20);
      const volMa20 = getAverage(windowVol);

      result[i].MA20 = ma20;
      result[i].STD20 = std20;
      result[i].Upper = ma20 + std20 * 2;
      result[i].Lower = ma20 - std20 * 2;
      result[i].Vol_MA20 = volMa20;
      result[i].Vol_Spike = result[i].volume > volMa20 * 2;
    } else {
      result[i].MA20 = null;
      result[i].STD20 = null;
      result[i].Upper = null;
      result[i].Lower = null;
      result[i].Vol_MA20 = null;
      result[i].Vol_Spike = false;
    }
  }

  // RSI
  let gains = 0;
  let losses = 0;

  // First 14 days average gain/loss
  for (let i = 1; i <= 14 && i < result.length; i++) {
    const diff = result[i].close - result[i - 1].close;
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / 14;
  let avgLoss = losses / 14;

  for (let i = 0; i < result.length; i++) {
    if (i < 14) {
      result[i].RSI = null;
      continue;
    }

    if (i === 14) {
      if (avgLoss === 0) result[i].RSI = 100;
      else {
        const rs = avgGain / avgLoss;
        result[i].RSI = 100 - 100 / (1 + rs);
      }
    } else {
      const diff = result[i].close - result[i - 1].close;
      const currentGain = Math.max(diff, 0);
      const currentLoss = Math.max(-diff, 0);

      avgGain = (avgGain * 13 + currentGain) / 14;
      avgLoss = (avgLoss * 13 + currentLoss) / 14;

      if (avgLoss === 0) result[i].RSI = 100;
      else {
        const rs = avgGain / avgLoss;
        result[i].RSI = 100 - 100 / (1 + rs);
      }
    }
  }

  return result;
}

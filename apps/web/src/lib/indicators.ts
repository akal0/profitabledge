/**
 * Technical Indicators Library
 * Provides common trading indicators for chart analysis
 */

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface MACDResult {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBandsResult {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface StochResult {
  time: number;
  k: number;
  d: number;
}

// ============================================
// Moving Averages
// ============================================

/**
 * Simple Moving Average (SMA)
 */
export function sma(data: CandleData[], period: number): IndicatorPoint[] {
  if (data.length < period) return [];

  const result: IndicatorPoint[] = [];
  let sum = 0;

  // Initialize first sum
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  result.push({ time: data[period - 1].time, value: sum / period });

  // Rolling calculation
  for (let i = period; i < data.length; i++) {
    sum = sum - data[i - period].close + data[i].close;
    result.push({ time: data[i].time, value: sum / period });
  }

  return result;
}

/**
 * Exponential Moving Average (EMA)
 */
export function ema(data: CandleData[], period: number): IndicatorPoint[] {
  if (data.length < period) return [];

  const result: IndicatorPoint[] = [];
  const multiplier = 2 / (period + 1);

  // Start with SMA for first value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let emaValue = sum / period;
  result.push({ time: data[period - 1].time, value: emaValue });

  // Calculate EMA for rest
  for (let i = period; i < data.length; i++) {
    emaValue = (data[i].close - emaValue) * multiplier + emaValue;
    result.push({ time: data[i].time, value: emaValue });
  }

  return result;
}

/**
 * Weighted Moving Average (WMA)
 */
export function wma(data: CandleData[], period: number): IndicatorPoint[] {
  if (data.length < period) return [];

  const result: IndicatorPoint[] = [];
  const denominator = (period * (period + 1)) / 2;

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - period + 1 + j].close * (j + 1);
    }
    result.push({ time: data[i].time, value: sum / denominator });
  }

  return result;
}

// ============================================
// Momentum Indicators
// ============================================

/**
 * Relative Strength Index (RSI)
 */
export function rsi(data: CandleData[], period: number = 14): IndicatorPoint[] {
  if (data.length < period + 1) return [];

  const result: IndicatorPoint[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // First average
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // First RSI
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsiValue = 100 - 100 / (1 + rs);
  result.push({ time: data[period].time, value: rsiValue });

  // Subsequent RSI values using smoothed averages
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValue = 100 - 100 / (1 + rs);
    result.push({ time: data[i + 1].time, value: rsiValue });
  }

  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function macd(
  data: CandleData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult[] {
  const fastEMA = ema(data, fastPeriod);
  const slowEMA = ema(data, slowPeriod);

  if (fastEMA.length === 0 || slowEMA.length === 0) return [];

  // Align EMAs by time
  const startTime = slowEMA[0].time;
  const alignedFast = fastEMA.filter((p) => p.time >= startTime);

  if (alignedFast.length !== slowEMA.length) return [];

  // Calculate MACD line
  const macdLine: IndicatorPoint[] = [];
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push({
      time: slowEMA[i].time,
      value: alignedFast[i].value - slowEMA[i].value,
    });
  }

  // Calculate signal line (EMA of MACD)
  if (macdLine.length < signalPeriod) return [];

  const multiplier = 2 / (signalPeriod + 1);
  let signalValue =
    macdLine.slice(0, signalPeriod).reduce((a, b) => a + b.value, 0) / signalPeriod;

  const result: MACDResult[] = [];
  result.push({
    time: macdLine[signalPeriod - 1].time,
    macd: macdLine[signalPeriod - 1].value,
    signal: signalValue,
    histogram: macdLine[signalPeriod - 1].value - signalValue,
  });

  for (let i = signalPeriod; i < macdLine.length; i++) {
    signalValue = (macdLine[i].value - signalValue) * multiplier + signalValue;
    result.push({
      time: macdLine[i].time,
      macd: macdLine[i].value,
      signal: signalValue,
      histogram: macdLine[i].value - signalValue,
    });
  }

  return result;
}

/**
 * Stochastic Oscillator
 */
export function stochastic(
  data: CandleData[],
  kPeriod: number = 14,
  dPeriod: number = 3
): StochResult[] {
  if (data.length < kPeriod) return [];

  const kValues: IndicatorPoint[] = [];

  // Calculate %K
  for (let i = kPeriod - 1; i < data.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;

    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (data[j].high > highest) highest = data[j].high;
      if (data[j].low < lowest) lowest = data[j].low;
    }

    const range = highest - lowest;
    const k = range === 0 ? 50 : ((data[i].close - lowest) / range) * 100;
    kValues.push({ time: data[i].time, value: k });
  }

  // Calculate %D (SMA of %K)
  if (kValues.length < dPeriod) return [];

  const result: StochResult[] = [];
  let sum = 0;

  for (let i = 0; i < dPeriod; i++) {
    sum += kValues[i].value;
  }
  result.push({
    time: kValues[dPeriod - 1].time,
    k: kValues[dPeriod - 1].value,
    d: sum / dPeriod,
  });

  for (let i = dPeriod; i < kValues.length; i++) {
    sum = sum - kValues[i - dPeriod].value + kValues[i].value;
    result.push({
      time: kValues[i].time,
      k: kValues[i].value,
      d: sum / dPeriod,
    });
  }

  return result;
}

// ============================================
// Volatility Indicators
// ============================================

/**
 * Bollinger Bands
 */
export function bollingerBands(
  data: CandleData[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsResult[] {
  if (data.length < period) return [];

  const result: BollingerBandsResult[] = [];
  const smaValues = sma(data, period);

  for (let i = 0; i < smaValues.length; i++) {
    const dataIndex = i + period - 1;
    const slice = data.slice(dataIndex - period + 1, dataIndex + 1);

    // Calculate standard deviation
    const mean = smaValues[i].value;
    const squaredDiffs = slice.map((d) => Math.pow(d.close - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(variance);

    result.push({
      time: smaValues[i].time,
      upper: mean + stdDev * sd,
      middle: mean,
      lower: mean - stdDev * sd,
    });
  }

  return result;
}

/**
 * Average True Range (ATR)
 */
export function atr(data: CandleData[], period: number = 14): IndicatorPoint[] {
  if (data.length < period + 1) return [];

  const trueRanges: number[] = [];

  // Calculate True Range for each candle
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }

  // First ATR is simple average
  let atrValue = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result: IndicatorPoint[] = [{ time: data[period].time, value: atrValue }];

  // Subsequent ATR values using smoothed average
  for (let i = period; i < trueRanges.length; i++) {
    atrValue = (atrValue * (period - 1) + trueRanges[i]) / period;
    result.push({ time: data[i + 1].time, value: atrValue });
  }

  return result;
}

// ============================================
// Volume Indicators
// ============================================

/**
 * Volume Weighted Average Price (VWAP)
 * Note: Resets daily in real implementation
 */
export function vwap(data: CandleData[]): IndicatorPoint[] {
  if (data.length === 0) return [];

  const result: IndicatorPoint[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const candle of data) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volume = candle.volume || 1;

    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;

    result.push({
      time: candle.time,
      value: cumulativeTPV / cumulativeVolume,
    });
  }

  return result;
}

/**
 * On-Balance Volume (OBV)
 */
export function obv(data: CandleData[]): IndicatorPoint[] {
  if (data.length < 2) return [];

  const result: IndicatorPoint[] = [{ time: data[0].time, value: data[0].volume || 0 }];
  let obvValue = data[0].volume || 0;

  for (let i = 1; i < data.length; i++) {
    const volume = data[i].volume || 0;
    if (data[i].close > data[i - 1].close) {
      obvValue += volume;
    } else if (data[i].close < data[i - 1].close) {
      obvValue -= volume;
    }
    result.push({ time: data[i].time, value: obvValue });
  }

  return result;
}

// ============================================
// Support/Resistance Detection
// ============================================

/**
 * Find pivot points (support/resistance levels)
 */
export function pivotPoints(
  data: CandleData[],
  leftBars: number = 5,
  rightBars: number = 5
): { time: number; price: number; type: "support" | "resistance" }[] {
  const result: { time: number; price: number; type: "support" | "resistance" }[] = [];

  for (let i = leftBars; i < data.length - rightBars; i++) {
    let isHighPivot = true;
    let isLowPivot = true;

    // Check left bars
    for (let j = 1; j <= leftBars; j++) {
      if (data[i - j].high >= data[i].high) isHighPivot = false;
      if (data[i - j].low <= data[i].low) isLowPivot = false;
    }

    // Check right bars
    for (let j = 1; j <= rightBars; j++) {
      if (data[i + j].high >= data[i].high) isHighPivot = false;
      if (data[i + j].low <= data[i].low) isLowPivot = false;
    }

    if (isHighPivot) {
      result.push({ time: data[i].time, price: data[i].high, type: "resistance" });
    }
    if (isLowPivot) {
      result.push({ time: data[i].time, price: data[i].low, type: "support" });
    }
  }

  return result;
}

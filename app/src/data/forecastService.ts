/**
 * Forecast service - uses ONNX models for predictions when available,
 * falls back to rolling mean baseline.
 */
import { lookupSensorValue, dataEndMs } from './dataService';
import { isOnnxReady, predictAll } from './onnxService';

/**
 * Get recent hourly raw water level values for feature computation.
 * Returns array of `count` values, newest last.
 */
function getRecentHourlyValues(bridgeId: number, atMs: number, count: number): number[] {
  const values: number[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const rec = lookupSensorValue(bridgeId, atMs - i * 3600000);
    if (rec) {
      values.push(rec.waterLevel); // raw value (negative meters)
    }
  }
  return values;
}

export interface ForecastResult {
  h6: number;  // cm
  h24: number; // cm
  h72: number; // cm
  source: 'onnx' | 'baseline';
}

/**
 * Get forecast values at +6h, +24h, +72h for a bridge at a given time.
 * Uses ONNX when available, rolling mean baseline otherwise.
 */
export async function getForecastValues(
  bridgeId: number,
  dateMs: number
): Promise<ForecastResult> {
  // For bridges other than 1, use bridge 1 data (primary sensor)
  const sensorBridge = (bridgeId === 1 || bridgeId === 3) ? bridgeId : 1;
  const recentValues = getRecentHourlyValues(sensorBridge, dateMs, 96);

  if (isOnnxReady() && recentValues.length >= 48) {
    const pred = await predictAll(recentValues);

    if (pred.h6 !== null && pred.h24 !== null && pred.h72 !== null) {
      // Model outputs are in raw scale (negative meters), convert to positive cm
      const toCm = (v: number) => Math.round(Math.abs(v) * 100);
      return {
        h6: toCm(pred.h6),
        h24: toCm(pred.h24),
        h72: toCm(pred.h72),
        source: 'onnx',
      };
    }
  }

  // Fallback: rolling mean baseline
  const current = lookupSensorValue(sensorBridge, dateMs);
  const currentCm = current ? current.waterLevelCm : 200;

  const last6: number[] = [];
  for (let i = 1; i <= 6; i++) {
    const rec = lookupSensorValue(sensorBridge, dateMs - i * 3600000);
    if (rec) last6.push(rec.waterLevelCm);
  }
  const baseline = last6.length > 0
    ? Math.round(last6.reduce((s, v) => s + v, 0) / last6.length)
    : currentCm;

  return {
    h6: baseline,
    h24: baseline,
    h72: baseline,
    source: 'baseline',
  };
}

/**
 * Generate hourly forecast array for chart display using ONNX at key points.
 */
export async function getForecastSeries(
  bridgeId: number,
  fromDateMs: number,
  hours: number
): Promise<{ time: string; value: number; source: string }[]> {
  const result: { time: string; value: number; source: string }[] = [];
  const sensorBridge = (bridgeId === 1 || bridgeId === 3) ? bridgeId : 1;

  // For points within data range, use real data
  // For points beyond, interpolate between ONNX predictions
  const forecast = await getForecastValues(sensorBridge, fromDateMs);

  // Known prediction points (hours from now -> value)
  const keyPoints: [number, number][] = [
    [0, lookupSensorValue(sensorBridge, fromDateMs)?.waterLevelCm ?? forecast.h6],
    [6, forecast.h6],
    [24, forecast.h24],
    [72, forecast.h72],
  ];

  for (let i = 1; i <= hours; i++) {
    const t = new Date(fromDateMs + i * 3600000);
    const tMs = t.getTime();

    // If within real data range, prefer real data
    if (tMs <= dataEndMs) {
      const rec = lookupSensorValue(sensorBridge, tMs);
      if (rec) {
        result.push({ time: t.toISOString(), value: rec.waterLevelCm, source: 'data' });
        continue;
      }
    }

    // Interpolate between key prediction points
    let lo = keyPoints[0], hi = keyPoints[keyPoints.length - 1];
    for (let k = 0; k < keyPoints.length - 1; k++) {
      if (i >= keyPoints[k][0] && i <= keyPoints[k + 1][0]) {
        lo = keyPoints[k];
        hi = keyPoints[k + 1];
        break;
      }
    }

    const range = hi[0] - lo[0];
    const t_ratio = range > 0 ? (i - lo[0]) / range : 0;
    const value = Math.round(lo[1] + (hi[1] - lo[1]) * t_ratio);

    result.push({ time: t.toISOString(), value, source: forecast.source });
  }

  return result;
}

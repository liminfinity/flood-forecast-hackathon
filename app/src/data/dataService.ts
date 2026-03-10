/**
 * Real data service — loads sensor CSV and provides lookup functions.
 * Falls back to synthetic generation for bridges/dates without real data.
 */

export interface SensorRecord {
  timestamp: number; // epoch ms
  waterLevel: number; // original value (negative, meters)
  waterLevelCm: number; // converted to positive cm (abs * 100)
  temperature: number;
  precipitation: number;
}

type BridgeSensorData = Map<number, SensorRecord[]>;

let sensorData: BridgeSensorData | null = null;
let loadPromise: Promise<BridgeSensorData> | null = null;

// Data range (will be set after loading)
export let dataStartMs = 0;
export let dataEndMs = 0;
export let dataLoaded = false;

export async function loadSensorData(): Promise<BridgeSensorData> {
  if (sensorData) return sensorData;
  if (loadPromise) return loadPromise;

  loadPromise = fetch('/data/sensor_data.csv')
    .then((r) => r.text())
    .then((csv) => {
      const lines = csv.trim().split('\n');
      const result: BridgeSensorData = new Map();

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const bridgeId = parseInt(cols[0]);
        const timestamp = new Date(cols[1]).getTime();
        const wl = parseFloat(cols[2]);
        const temp = parseFloat(cols[4]); // temperature_2m
        const precip = parseFloat(cols[10]); // precipitation

        if (isNaN(timestamp) || isNaN(wl)) continue;

        if (!result.has(bridgeId)) result.set(bridgeId, []);
        result.get(bridgeId)!.push({
          timestamp,
          waterLevel: wl,
          waterLevelCm: Math.round(Math.abs(wl) * 100),
          temperature: isNaN(temp) ? 0 : Math.round(temp * 10) / 10,
          precipitation: isNaN(precip) ? 0 : Math.round(precip * 10) / 10,
        });
      }

      // Sort by timestamp
      for (const [, records] of result) {
        records.sort((a, b) => a.timestamp - b.timestamp);
      }

      // Set data range from bridge 1 (primary sensor)
      const b1 = result.get(1);
      if (b1 && b1.length > 0) {
        dataStartMs = b1[0].timestamp;
        dataEndMs = b1[b1.length - 1].timestamp;
      }

      sensorData = result;
      dataLoaded = true;
      return result;
    });

  return loadPromise;
}

export function getSensorDataSync(): BridgeSensorData | null {
  return sensorData;
}

/**
 * Find the closest sensor record for a given bridge and time.
 * Uses linear interpolation between two nearest hourly records.
 */
export function lookupSensorValue(
  bridgeId: number,
  dateMs: number
): SensorRecord | null {
  if (!sensorData) return null;

  const records = sensorData.get(bridgeId);
  if (!records || records.length === 0) return null;

  // Clamp to data range
  if (dateMs <= records[0].timestamp) return records[0];
  if (dateMs >= records[records.length - 1].timestamp)
    return records[records.length - 1];

  // Binary search for closest
  let lo = 0,
    hi = records.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (records[mid].timestamp <= dateMs) lo = mid;
    else hi = mid;
  }

  const a = records[lo];
  const b = records[hi];
  const t = (dateMs - a.timestamp) / (b.timestamp - a.timestamp);

  return {
    timestamp: dateMs,
    waterLevel: a.waterLevel + (b.waterLevel - a.waterLevel) * t,
    waterLevelCm: Math.round(a.waterLevelCm + (b.waterLevelCm - a.waterLevelCm) * t),
    temperature: Math.round((a.temperature + (b.temperature - a.temperature) * t) * 10) / 10,
    precipitation: Math.round((a.precipitation + (b.precipitation - a.precipitation) * t) * 10) / 10,
  };
}

/**
 * Get history array for chart display.
 */
export function getRealHistory(
  bridgeId: number,
  centerDate: Date,
  hours: number
): { time: string; value: number }[] {
  const result: { time: string; value: number }[] = [];
  for (let i = 0; i < hours; i++) {
    const t = new Date(centerDate.getTime() - (hours - 1 - i) * 3600000);
    const rec = lookupSensorValue(bridgeId, t.getTime());
    if (rec) {
      result.push({ time: t.toISOString(), value: rec.waterLevelCm });
    }
  }
  return result;
}

/**
 * Get forecast using rolling mean baseline (average of last 6 values).
 * For dates within data range, uses actual data. Beyond range, uses baseline.
 */
export function getRealForecast(
  bridgeId: number,
  fromDate: Date,
  hours: number
): { time: string; value: number }[] {
  const result: { time: string; value: number }[] = [];

  // Get last 6 values for baseline
  const recentValues: number[] = [];
  for (let i = 6; i >= 1; i--) {
    const rec = lookupSensorValue(bridgeId, fromDate.getTime() - i * 3600000);
    if (rec) recentValues.push(rec.waterLevelCm);
  }
  const baseline =
    recentValues.length > 0
      ? Math.round(recentValues.reduce((s, v) => s + v, 0) / recentValues.length)
      : null;

  for (let i = 1; i <= hours; i++) {
    const t = new Date(fromDate.getTime() + i * 3600000);
    const rec = lookupSensorValue(bridgeId, t.getTime());

    // If we have real data for this time, use it; otherwise baseline
    if (rec && t.getTime() <= dataEndMs) {
      result.push({ time: t.toISOString(), value: rec.waterLevelCm });
    } else if (baseline !== null) {
      // Add small noise to baseline for realism
      const noise = Math.sin(i * 0.7 + bridgeId) * 2;
      result.push({ time: t.toISOString(), value: Math.round(baseline + noise) });
    }
  }
  return result;
}

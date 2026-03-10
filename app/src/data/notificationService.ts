/**
 * Real notification service based on actual sensor data, thresholds, and CFRM risk model.
 */
import type { BridgeState, RiskLevel } from './mockData';
import { getRiskLevel } from './mockData';
import { lookupSensorValue } from './dataService';
import { computeCfrm, getRiskClassLabel, type CfrmRiskClass } from './cfrmService';

export interface Notification {
  id: string;
  level: 'info' | 'warning' | 'critical';
  bridgeId: number | null;
  bridgeName: string | null;
  time: Date;
  message: string;
}

const THRESHOLD_WARNING = 180;
const THRESHOLD_DANGER = 120;

/**
 * Generate notifications based on bridge states, trend analysis, and CFRM risk model.
 */
export function generateNotifications(states: BridgeState[], date: Date): Notification[] {
  const notifs: Notification[] = [];

  for (const b of states) {
    const rec3hAgo = lookupSensorValue(b.id <= 2 ? 1 : (b.id <= 4 ? 3 : 1), date.getTime() - 3 * 3600000);
    const trendCm = rec3hAgo ? b.waterLevel - rec3hAgo.waterLevelCm : 0;
    const falling = trendCm < -5;

    // CFRM-based notifications
    const cfrm = computeCfrm(b, date, 'day');
    if (cfrm.riskClass === 'CRITICAL') {
      notifs.push({
        id: `cfrm-crit-${b.id}`,
        level: 'critical',
        bridgeId: b.id,
        bridgeName: b.name,
        time: date,
        message: `${b.name}: критический индекс CFRM (${cfrm.score.toFixed(2)}). ${cfrm.explanations[0] || ''}`,
      });
    } else if (cfrm.riskClass === 'HIGH') {
      notifs.push({
        id: `cfrm-high-${b.id}`,
        level: 'warning',
        bridgeId: b.id,
        bridgeName: b.name,
        time: date,
        message: `${b.name}: повышенный риск по матмодели (CFRM ${cfrm.score.toFixed(2)}). ${cfrm.explanations[0] || ''}`,
      });
    }

    // Water level notifications
    if (b.risk === 'danger') {
      notifs.push({
        id: `danger-${b.id}`,
        level: 'critical',
        bridgeId: b.id,
        bridgeName: b.name,
        time: date,
        message: `${b.name}: уровень ${b.waterLevel} см — опасность подтопления${falling ? ', вода продолжает подниматься' : ''}`,
      });
    } else if (b.risk === 'warning') {
      notifs.push({
        id: `warn-${b.id}`,
        level: 'warning',
        bridgeId: b.id,
        bridgeName: b.name,
        time: date,
        message: `${b.name}: уровень ${b.waterLevel} см — повышенный${falling ? ', тенденция к росту' : ', стабильно'}`,
      });
    }

    // Trend alert
    if (Math.abs(trendCm) > 10 && b.risk === 'safe') {
      notifs.push({
        id: `trend-${b.id}`,
        level: 'info',
        bridgeId: b.id,
        bridgeName: b.name,
        time: date,
        message: `${b.name}: ${falling ? 'быстрый подъём' : 'быстрое снижение'} воды (${Math.abs(trendCm)} см за 3ч)`,
      });
    }
  }

  // Precipitation alert
  const highPrecip = states.filter(b => b.precipitation > 3);
  if (highPrecip.length > 0) {
    notifs.push({
      id: 'precip-alert',
      level: 'warning',
      bridgeId: null,
      bridgeName: null,
      time: date,
      message: `Обильные осадки (${highPrecip[0].precipitation} мм) — возможен подъём воды`,
    });
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const unique = notifs.filter(n => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  const levelOrder = { critical: 0, warning: 1, info: 2 };
  return unique.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
}

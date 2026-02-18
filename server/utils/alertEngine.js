/**
 * Dynamic Alert Engine
 * Generates context-aware alerts based on groundwater data thresholds.
 * Now supports trend-based alerts when full history is provided.
 */

const ALERT_THRESHOLDS = {
  criticalWaterLevel: 15,       // meters - critical depth
  warningWaterLevel: 12,        // meters - warning depth
  highDepletion: 5,             // percentage
  criticalDepletion: 7,         // percentage
  lowRainfall: 700,             // mm
  criticalRainfall: 600,        // mm
  highPH: 8.0,
  lowPH: 6.5,
  highConsumption: 500,         // Ml
};

/**
 * Generate alerts for a given data record.
 * @param {Object} data - Latest water data record
 * @param {Array} [history] - Optional full history array for trend-based alerts
 */
function generateAlerts(data, history) {
  const alerts = [];
  const timestamp = new Date().toISOString();

  // Water Level Alerts
  if (data.groundwaterLevel >= ALERT_THRESHOLDS.criticalWaterLevel) {
    alerts.push({
      type: 'critical',
      category: 'Water Level',
      title: '🚨 Critical Water Level',
      message: `Groundwater level at ${data.groundwaterLevel}m depth in ${data.location}. Immediate action required.`,
      value: data.groundwaterLevel,
      threshold: ALERT_THRESHOLDS.criticalWaterLevel,
      recommendation: 'Implement water rationing and emergency recharge measures.',
      timestamp,
    });
  } else if (data.groundwaterLevel >= ALERT_THRESHOLDS.warningWaterLevel) {
    alerts.push({
      type: 'warning',
      category: 'Water Level',
      title: '⚠️ Low Water Table',
      message: `Water table at ${data.groundwaterLevel}m in ${data.location}. Monitor closely.`,
      value: data.groundwaterLevel,
      threshold: ALERT_THRESHOLDS.warningWaterLevel,
      recommendation: 'Increase monitoring frequency. Consider water conservation measures.',
      timestamp,
    });
  }

  // Depletion Alerts
  if (data.depletionRate >= ALERT_THRESHOLDS.criticalDepletion) {
    alerts.push({
      type: 'critical',
      category: 'Depletion',
      title: '🚨 Over-extraction Detected',
      message: `Groundwater depletion rate at ${data.depletionRate}% in ${data.location}. Aquifer stress is severe.`,
      value: data.depletionRate,
      threshold: ALERT_THRESHOLDS.criticalDepletion,
      recommendation: 'Restrict bore-well usage. Implement mandatory rainwater harvesting.',
      timestamp,
    });
  } else if (data.depletionRate >= ALERT_THRESHOLDS.highDepletion) {
    alerts.push({
      type: 'warning',
      category: 'Depletion',
      title: '⚠️ High Depletion Rate',
      message: `Depletion rate ${data.depletionRate}% in ${data.location}. Extraction exceeds recharge.`,
      value: data.depletionRate,
      threshold: ALERT_THRESHOLDS.highDepletion,
      recommendation: 'Promote water-efficient irrigation. Review extraction permits.',
      timestamp,
    });
  }

  // Rainfall Alerts
  if (data.rainfall <= ALERT_THRESHOLDS.criticalRainfall) {
    alerts.push({
      type: 'critical',
      category: 'Rainfall',
      title: '🚨 Drought Risk',
      message: `Rainfall only ${data.rainfall}mm in ${data.location}. Severe drought conditions likely.`,
      value: data.rainfall,
      threshold: ALERT_THRESHOLDS.criticalRainfall,
      recommendation: 'Activate drought contingency plans. Arrange water tanker supply.',
      timestamp,
    });
  } else if (data.rainfall <= ALERT_THRESHOLDS.lowRainfall) {
    alerts.push({
      type: 'warning',
      category: 'Rainfall',
      title: '⚠️ Below Normal Rainfall',
      message: `Rainfall ${data.rainfall}mm in ${data.location}, below expected levels.`,
      value: data.rainfall,
      threshold: ALERT_THRESHOLDS.lowRainfall,
      recommendation: 'Monitor reservoir levels. Advise farmers on drought-resistant crops.',
      timestamp,
    });
  }

  // pH Alerts
  if (data.ph >= ALERT_THRESHOLDS.highPH || data.ph <= ALERT_THRESHOLDS.lowPH) {
    alerts.push({
      type: 'warning',
      category: 'Water Quality',
      title: '⚠️ pH Imbalance',
      message: `pH level ${data.ph} in ${data.location}. Water quality may be affected.`,
      value: data.ph,
      threshold: `${ALERT_THRESHOLDS.lowPH}-${ALERT_THRESHOLDS.highPH}`,
      recommendation: 'Test for contaminants. Advise water treatment before consumption.',
      timestamp,
    });
  }

  // Consumption Alert
  if (data.consumption >= ALERT_THRESHOLDS.highConsumption) {
    alerts.push({
      type: 'info',
      category: 'Consumption',
      title: 'ℹ️ High Water Consumption',
      message: `Total consumption ${data.consumption} Ml in ${data.location}. Above district average.`,
      value: data.consumption,
      threshold: ALERT_THRESHOLDS.highConsumption,
      recommendation: 'Review industrial and agricultural water permits. Promote efficiency.',
      timestamp,
    });
  }

  // Scarcity Level Alert
  if (data.scarcityLevel === 'Severe' || data.scarcityLevel === 'Extreme') {
    alerts.push({
      type: 'critical',
      category: 'Scarcity',
      title: `🚨 ${data.scarcityLevel} Water Scarcity`,
      message: `${data.location} classified as ${data.scarcityLevel} water scarcity zone.`,
      value: data.scarcityLevel,
      recommendation: 'Prioritize for government water supply augmentation schemes.',
      timestamp,
    });
  }

  // ===== TREND-BASED ALERTS (require history) =====
  if (history && history.length >= 3) {
    const sorted = [...history].sort((a, b) => a.year - b.year);

    // Consecutive decline in water level (rising depth) for 3+ years
    let consecutiveRise = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].groundwaterLevel > sorted[i - 1].groundwaterLevel) {
        consecutiveRise++;
      } else {
        consecutiveRise = 0;
      }
    }
    if (consecutiveRise >= 3) {
      const totalRise = sorted[sorted.length - 1].groundwaterLevel - sorted[sorted.length - 1 - consecutiveRise].groundwaterLevel;
      alerts.push({
        type: 'warning',
        category: 'Trend',
        title: '📉 Sustained Water Level Decline',
        message: `Water level in ${data.location} has been dropping for ${consecutiveRise} consecutive years (${totalRise.toFixed(1)}m increase in depth).`,
        value: consecutiveRise,
        recommendation: 'Long-term recharge intervention needed. Consider artificial recharge structures.',
        timestamp,
      });
    }

    // Steady depletion increase over 3+ years
    let consecutiveDepIncrease = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].depletionRate > sorted[i - 1].depletionRate) {
        consecutiveDepIncrease++;
      } else {
        consecutiveDepIncrease = 0;
      }
    }
    if (consecutiveDepIncrease >= 3) {
      alerts.push({
        type: 'critical',
        category: 'Trend',
        title: '📊 Accelerating Depletion Trend',
        message: `Depletion rate in ${data.location} has increased for ${consecutiveDepIncrease} consecutive years. Current: ${data.depletionRate}%.`,
        value: consecutiveDepIncrease,
        recommendation: 'Urgent policy intervention needed. Restrict new extraction permits.',
        timestamp,
      });
    }

    // Declining rainfall pattern
    let consecutiveRainfallDrop = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].rainfall < sorted[i - 1].rainfall) {
        consecutiveRainfallDrop++;
      } else {
        consecutiveRainfallDrop = 0;
      }
    }
    if (consecutiveRainfallDrop >= 3) {
      alerts.push({
        type: 'warning',
        category: 'Trend',
        title: '🌧️ Declining Rainfall Pattern',
        message: `Rainfall in ${data.location} has decreased for ${consecutiveRainfallDrop} consecutive years. Long-term drought risk elevated.`,
        value: consecutiveRainfallDrop,
        recommendation: 'Plan for drought resilience. Increase water storage capacity.',
        timestamp,
      });
    }

    // Overall score deterioration
    const { calculateWaterScore } = require('./waterScore');
    const scores = sorted.map(d => calculateWaterScore(d));
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (avgSecond < avgFirst - 10) {
      alerts.push({
        type: 'warning',
        category: 'Trend',
        title: '⚡ Overall Water Health Declining',
        message: `Water health score in ${data.location} has declined significantly (avg ${Math.round(avgFirst)} → ${Math.round(avgSecond)}) over the monitoring period.`,
        value: Math.round(avgSecond - avgFirst),
        recommendation: 'Comprehensive water management review recommended for this location.',
        timestamp,
      });
    }
  }

  return alerts;
}

/**
 * Generate government-style updates
 */
function generateGovUpdates(locationData) {
  const latest = locationData[locationData.length - 1];
  if (!latest) return [];

  const updates = [
    {
      id: 1,
      title: 'Groundwater Status Report',
      body: `Current groundwater level in ${latest.location} stands at ${latest.groundwaterLevel}m. Depletion rate: ${latest.depletionRate}%. Classification: ${latest.scarcityLevel}.`,
      date: new Date().toLocaleDateString('en-IN'),
      source: 'Central Ground Water Board',
      priority: latest.scarcityLevel === 'Severe' || latest.scarcityLevel === 'Extreme' ? 'high' : 'normal',
    },
    {
      id: 2,
      title: 'Rainfall Monitoring Update',
      body: `Annual rainfall recorded: ${latest.rainfall}mm. ${latest.rainfall < 700 ? 'Below normal levels. Drought alert issued.' : 'Within normal range.'}`,
      date: new Date().toLocaleDateString('en-IN'),
      source: 'India Meteorological Department',
      priority: latest.rainfall < 700 ? 'high' : 'normal',
    },
    {
      id: 3,
      title: 'Water Quality Assessment',
      body: `pH level: ${latest.ph}. ${latest.ph >= 6.5 && latest.ph <= 8.0 ? 'Water quality is within acceptable BIS standards.' : 'Water quality needs attention.'}`,
      date: new Date().toLocaleDateString('en-IN'),
      source: 'State Pollution Control Board',
      priority: 'normal',
    },
    {
      id: 4,
      title: 'Usage Distribution Report',
      body: `Agricultural: ${latest.agriculturalUsage} Ml | Industrial: ${latest.industrialUsage} Ml | Household: ${latest.householdUsage} Ml. Total consumption: ${latest.consumption} Ml.`,
      date: new Date().toLocaleDateString('en-IN'),
      source: 'Nashik District Water Authority',
      priority: 'normal',
    },
    {
      id: 5,
      title: 'Jal Shakti Abhiyan Advisory',
      body: `Under the National Jal Jeevan Mission, ${latest.location} is ${latest.scarcityLevel === 'High' || latest.scarcityLevel === 'Severe' ? 'marked for priority intervention. Community rainwater harvesting programs recommended.' : 'under regular monitoring. Continue existing conservation measures.'}`,
      date: new Date().toLocaleDateString('en-IN'),
      source: 'Ministry of Jal Shakti',
      priority: latest.scarcityLevel === 'High' || latest.scarcityLevel === 'Severe' ? 'high' : 'normal',
    },
  ];

  return updates;
}

module.exports = { generateAlerts, generateGovUpdates, ALERT_THRESHOLDS };

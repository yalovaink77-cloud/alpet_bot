const { scoreEvent } = require('./confidenceCalibrator');
const { validateSignal } = require('../utils/schemaValidator');
const { APP_CONFIG } = require('../../config/app');

function chooseDirection(event, instrument) {
  if (event.channels.includes('gold_up') && ['XAUUSD', 'KOZAL'].includes(instrument)) {
    return 'LONG';
  }

  if (event.channels.includes('oil_up') && ['BRENT'].includes(instrument)) {
    return 'LONG';
  }

  if (event.channels.includes('oil_up') && ['THYAO', 'PGSUS'].includes(instrument)) {
    return 'SHORT';
  }

  if (event.channels.includes('usdtry_up') && instrument === 'USDTRY') {
    return 'LONG';
  }

  if (event.channels.includes('risk_off') && instrument === 'VIOP30') {
    return 'SHORT';
  }

  return 'WATCH';
}

function chooseDecision(finalScore) {
  if (finalScore >= APP_CONFIG.thresholds.execute) {
    return 'EXECUTE';
  }

  if (finalScore >= APP_CONFIG.thresholds.watch) {
    return 'WATCH';
  }

  return 'IGNORE';
}

function buildSignals(event, reactionStats, matches) {
  return reactionStats.map((stats) => {
    const scoring = scoreEvent(event, stats, matches.length);
    const decision = chooseDecision(scoring.finalScore);
    const chosenDirection = chooseDirection(event, stats.instrument);
    const direction = decision === 'IGNORE' ? 'NONE' : chosenDirection === 'WATCH' ? 'WATCH' : chosenDirection;
    const normalizedDecision = direction === 'WATCH' && decision === 'EXECUTE' ? 'WATCH' : decision;
    const tradeConfidence = Number(Math.min(Math.max(scoring.finalScore / 100, 0), 1).toFixed(4));

    return validateSignal({
      instrument: stats.instrument,
      decision: normalizedDecision,
      direction,
      finalScore: scoring.finalScore,
      tradeConfidence,
      scoreBreakdown: scoring,
      explanation: {
        eventType: event.eventType,
        eventClass: event.eventClass,
        scoreBreakdown: scoring,
        matchCount: matches.length,
        consistencyScore: stats.consistencyScore,
        impactHorizon: stats.impactHorizon,
        sampleSize: stats.sampleSize,
        sameDirectionRatio1d: stats.sameDirectionRatio1d,
        medianMove1d: stats.medianMove1d,
        medianMove3d: stats.medianMove3d
      }
    });
  });
}

module.exports = {
  buildSignals
};
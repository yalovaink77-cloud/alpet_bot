const { scoreEvent } = require('./confidenceCalibrator');
const { validateSignal } = require('../utils/schemaValidator');
const { APP_CONFIG } = require('../../config/app');

function chooseDirection(event, instrument) {
  const ch = event.channels || [];

  // Altın haberleri
  if (ch.includes('gold_up') && ['XAUUSD', 'KOZAL'].includes(instrument)) return 'LONG';

  // Petrol haberleri
  if (ch.includes('oil_up') && ['BRENT', 'TUPRS'].includes(instrument)) return 'LONG';  // Tüpraş yüksek petrolden kazanır
  if (ch.includes('oil_up') && ['THYAO', 'PGSUS'].includes(instrument)) return 'SHORT'; // Havacılık yakıt maliyeti artar

  // Enflasyon riski
  if (ch.includes('inflation_risk') && ['BRENT', 'TUPRS'].includes(instrument)) return 'LONG';
  if (ch.includes('inflation_risk') && ['THYAO', 'PGSUS'].includes(instrument)) return 'SHORT';

  // Döviz hareketleri
  if ((ch.includes('usdtry_up') || ch.includes('usdtry_move')) && instrument === 'USDTRY') return 'LONG';
  if ((ch.includes('usdtry_up') || ch.includes('usdtry_move')) && ['GARAN', 'AKBNK'].includes(instrument)) return 'SHORT'; // TL krizi → bankalar düşer

  // Risk-off / piyasa düşüşü
  if ((ch.includes('risk_off') || ch.includes('risk_repricing')) && instrument === 'VIOP30') return 'SHORT';
  if ((ch.includes('risk_off') || ch.includes('risk_repricing')) && ['GARAN', 'AKBNK'].includes(instrument)) return 'SHORT';

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
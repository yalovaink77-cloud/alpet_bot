const { scoreEvent } = require('./confidenceCalibrator');
const { validateSignal } = require('../utils/schemaValidator');
const { APP_CONFIG } = require('../../config/app');

const FEEDER_TRADE_GATE_ENABLED = process.env.ENABLE_FEEDER_TRADE_GATE === 'true';

function chooseDirection(event, instrument) {
  // Extraction pipeline'dan gelen eventType, actors, stage, context ile senaryo tabanlı yön
  const ch = event.channels || [];
  const eventType = event.eventType || '';
  const actors = event.actors || [];
  const stage = event.eventStage || event.stage || '';

  // Savaş senaryosu
  if (eventType === 'war') {
    if (stage === 'initial' && ['BRENT', 'XAUUSD'].includes(instrument)) return 'LONG';
    if (stage === 'initial' && ['BIST30', 'VIOP30'].includes(instrument)) return 'SHORT';
    if (stage === 'ceasefire') return 'CLOSE';
    if (stage === 'escalation' && ['BRENT', 'XAUUSD'].includes(instrument)) return 'LONG';
    if (stage === 'escalation' && ['BIST30', 'VIOP30'].includes(instrument)) return 'SHORT';
    if (stage === 'victory' && actors.includes('USA')) return 'LONG';
    if (stage === 'victory' && actors.includes('Iran')) return 'SHORT';
  }
  // Deprem senaryosu
  if (eventType === 'earthquake') {
    if (event.eventMagnitude && event.eventMagnitude >= 7) {
      if (['insurance'].includes(instrument)) return 'SHORT';
      if (['construction'].includes(instrument)) return 'LONG';
      if (['BIST30', 'VIOP30'].includes(instrument)) return 'SHORT';
    }
  }
  // Diğer klasik kurallar (eski mantık)
  // Altın haberleri
  if (ch.includes('gold_up') && ['XAUUSD', 'KOZAL'].includes(instrument)) return 'LONG';
  // Petrol haberleri
  if (ch.includes('oil_up') && ['BRENT', 'TUPRS'].includes(instrument)) return 'LONG';
  if (ch.includes('oil_up') && ['THYAO', 'PGSUS'].includes(instrument)) return 'SHORT';
  // Enflasyon riski
  if (ch.includes('inflation_risk') && ['BRENT', 'TUPRS'].includes(instrument)) return 'LONG';
  if (ch.includes('inflation_risk') && ['THYAO', 'PGSUS'].includes(instrument)) return 'SHORT';
  // Döviz hareketleri
  if ((ch.includes('usdtry_up') || ch.includes('usdtry_move')) && instrument === 'USDTRY') return 'LONG';
  if ((ch.includes('usdtry_up') || ch.includes('usdtry_move')) && ['GARAN', 'AKBNK'].includes(instrument)) return 'SHORT';
  // Risk-off / piyasa düşüşü
  if ((ch.includes('risk_off') || ch.includes('risk_repricing')) && instrument === 'VIOP30') return 'SHORT';
  if ((ch.includes('risk_off') || ch.includes('risk_repricing')) && ['GARAN', 'AKBNK'].includes(instrument)) return 'SHORT';

  // NEWS_FEEDER_BOT signal_direction kullanımı (BIST/VIOP için güvenli sınırlı kullanım):
  // bullish → BIST/VIOP LONG, bearish → BIST/VIOP SHORT
  if (FEEDER_TRADE_GATE_ENABLED) {
    const sd = String(event?.metadata?.signalDirection || '').toLowerCase();
    const isBistOrViop = ['VIOP30', 'THYAO', 'PGSUS', 'TUPRS', 'KOZAL', 'GARAN', 'AKBNK'].includes(instrument);
    if (isBistOrViop && (sd === 'bullish' || sd === 'bearish')) {
      return sd === 'bullish' ? 'LONG' : 'SHORT';
    }
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
    const scoring = scoreEvent(event, matches.length, stats);
    const decision = chooseDecision(scoring.finalScore);
    const chosenDirection = chooseDirection(event, stats.instrument);
    const direction = decision === 'IGNORE' ? 'NONE' : chosenDirection === 'WATCH' ? 'WATCH' : chosenDirection;
    let normalizedDecision = direction === 'WATCH' && decision === 'EXECUTE' ? 'WATCH' : decision;

    // Trade gate: BIST/VIOP'ta düşük güven/önem/tier durumlarında EXECUTE'i WATCH'a indir.
    if (FEEDER_TRADE_GATE_ENABLED) {
      const isBistOrViop = ['VIOP30', 'THYAO', 'PGSUS', 'TUPRS', 'KOZAL', 'GARAN', 'AKBNK'].includes(stats.instrument);
      const tier = String(event?.metadata?.sourceTier || '').toLowerCase();
      const conf = Number(event?.metadata?.confidenceScore);
      const imp  = Number(event?.metadata?.importanceScore);
      const sd   = String(event?.metadata?.signalDirection || '').toLowerCase();

      if (normalizedDecision === 'EXECUTE' && isBistOrViop) {
        const tierOk = tier === 'tier_1' || tier === 'tier_2' || tier === '';
        const confOk = !Number.isFinite(conf) || conf >= 0.45;
        const impOk  = !Number.isFinite(imp)  || imp >= 0.40;
        const dirOk  = sd === '' || sd === 'bullish' || sd === 'bearish';

        if (!tierOk || !confOk || !impOk || !dirOk) {
          normalizedDecision = 'WATCH';
        }
      }
    }
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
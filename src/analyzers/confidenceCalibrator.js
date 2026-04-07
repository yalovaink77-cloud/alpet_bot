
function scoreEvent(event, matchCount, stats) {
  // Defensive defaults
  event = event || {};
  event.metadata = event.metadata || {};
  event.candidateInstruments = Array.isArray(event.candidateInstruments) ? event.candidateInstruments : [];
  matchCount = typeof matchCount === 'number' && !isNaN(matchCount) ? matchCount : 0;
  stats = stats || {};
  stats.consistencyScore = typeof stats.consistencyScore === 'number' && !isNaN(stats.consistencyScore) ? stats.consistencyScore : 0;
  stats.instrument = typeof stats.instrument === 'string' ? stats.instrument : '';

  const sourceScore = Math.min((event.metadata?.reliabilityScore) || 0, 15);
  let credibilityScore = event.credibility === 'high' ? 10 : event.credibility === 'medium' ? 6 : 2;
  const noveltyScore = event.novelty === 'new_information' ? 15 : event.novelty === 'developing_story' ? 8 : 2;
  let severityScore = event.severity === 'extreme' ? 15 : event.severity === 'high' ? 12 : event.severity === 'medium' ? 8 : 4;
  const turkeyRelevanceScore = event.directnessToTurkey === 'direct' ? 10 : event.directnessToTurkey === 'indirect' ? 7 : 4;
  const historicalSimilarityScore = Math.min(Math.round((matchCount / 10) * 15), 15);
  const historicalConsistencyScore = Math.min(Math.round((stats.consistencyScore || 0) * 10), 10);
  const instrumentAlignmentScore = event.candidateInstruments.includes(stats.instrument) ? 5 : 0;
  // NEWS_FEEDER_BOT metadata boost:
  // - confidenceScore: 0..1 → small credibility adjustment (max +3)
  // - importanceScore: 0..1 → small severity adjustment (max +3)
  const conf = Number(event.metadata?.confidenceScore);
  if (Number.isFinite(conf)) {
    credibilityScore = Math.min(10, credibilityScore + Math.round(conf * 3));
  }

  const imp = Number(event.metadata?.importanceScore);
  if (Number.isFinite(imp)) {
    severityScore = Math.min(15, severityScore + Math.round(imp * 3));
  }

  const timingScore = 5;

  const raw = sourceScore + credibilityScore + noveltyScore + severityScore + turkeyRelevanceScore + historicalSimilarityScore + historicalConsistencyScore + instrumentAlignmentScore + timingScore;

  let penalties = 0;
  const penaltyFlags = {
    alreadyPricedPenalty: false,
    singleSourcePenalty: false,
    thematicOnlyPenalty: event.directnessToTurkey === 'thematic',
    lowHistoryPenalty: matchCount < (event.directnessToTurkey === 'direct' ? 3 : event.directnessToTurkey === 'indirect' ? 5 : 8),
    contradictoryHistoryPenalty: matchCount >= 3 && (stats.consistencyScore || 0) < 0.45,
    executionRiskPenalty: false,
    portfolioCrowdingPenalty: false
  };

  // ── NEWS_FEEDER_BOT trade gate penalties (mainly for BIST/VIOP) ─────────────
  // Amaç: düşük güven / düşük önem / düşük kaynak kalitesi olayları EXECUTE'a
  // çıkmadan önce kırpmak.
  const FEEDER_TRADE_GATE_ENABLED = process.env.ENABLE_FEEDER_TRADE_GATE === 'true';
  if (FEEDER_TRADE_GATE_ENABLED) {
    const isBistOrViop = ['VIOP30', 'THYAO', 'PGSUS', 'TUPRS', 'KOZAL', 'GARAN', 'AKBNK'].includes(stats.instrument);
    const tier = String(event.metadata?.sourceTier || '').toLowerCase();
    const signalDir = String(event.metadata?.signalDirection || '').toLowerCase();

    if (isBistOrViop) {
      if (tier === 'tier_3') penalties += 6;
      if (tier === 'tier_4') penalties += 12;

      // Belirsiz yön = piyasa yön sinyali net değil → EXECUTE'i zorlaştır.
      if (signalDir === 'neutral') penalties += 6;

      // Çok düşük confidence/importance skorlarında ek kırpma.
      if (Number.isFinite(conf) && conf < 0.35) penalties += 8;
      if (Number.isFinite(imp) && imp < 0.35) penalties += 6;
    }
  }

  if (penaltyFlags.thematicOnlyPenalty) penalties += 8;
  if (penaltyFlags.lowHistoryPenalty) penalties += 10;
  if (penaltyFlags.contradictoryHistoryPenalty) penalties += 10;

  return {
    sourceScore,
    credibilityScore,
    noveltyScore,
    severityScore,
    turkeyRelevanceScore,
    historicalSimilarityScore,
    historicalConsistencyScore,
    instrumentAlignmentScore,
    timingScore,
    penaltyScore: penalties,
    finalScore: Math.max(Math.min(raw - penalties, 100), 0),
    penaltyFlags
  };
}

module.exports = {
  scoreEvent
};
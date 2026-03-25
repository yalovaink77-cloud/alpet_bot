
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
  const credibilityScore = event.credibility === 'high' ? 10 : event.credibility === 'medium' ? 6 : 2;
  const noveltyScore = event.novelty === 'new_information' ? 15 : event.novelty === 'developing_story' ? 8 : 2;
  const severityScore = event.severity === 'extreme' ? 15 : event.severity === 'high' ? 12 : event.severity === 'medium' ? 8 : 4;
  const turkeyRelevanceScore = event.directnessToTurkey === 'direct' ? 10 : event.directnessToTurkey === 'indirect' ? 7 : 4;
  const historicalSimilarityScore = Math.min(Math.round((matchCount / 10) * 15), 15);
  const historicalConsistencyScore = Math.min(Math.round((stats.consistencyScore || 0) * 10), 10);
  const instrumentAlignmentScore = event.candidateInstruments.includes(stats.instrument) ? 5 : 0;
  const timingScore = 5;

  const raw = sourceScore + credibilityScore + noveltyScore + severityScore + turkeyRelevanceScore + historicalSimilarityScore + historicalConsistencyScore + instrumentAlignmentScore + timingScore;

  let penalties = 0;
  const penaltyFlags = {
    alreadyPricedPenalty: false,
    singleSourcePenalty: false,
    thematicOnlyPenalty: event.directnessToTurkey === 'thematic',
    lowHistoryPenalty: matchCount < (event.directnessToTurkey === 'direct' ? 3 : event.directnessToTurkey === 'indirect' ? 5 : 8),
    contradictoryHistoryPenalty: (stats.consistencyScore || 0) < 0.45,
    executionRiskPenalty: false,
    portfolioCrowdingPenalty: false
  };

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
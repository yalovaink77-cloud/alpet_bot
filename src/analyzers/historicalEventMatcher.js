const historicalEventStore = require('../storage/historicalEventStore');

function computeSimilarity(event, priorEvent) {
  let score = 0;

  score += event.eventType === priorEvent.eventType ? 0.3 : 0;
  score += event.region === priorEvent.region ? 0.1 : 0;

  const channelOverlap = (event.channels || []).filter((channel) => (priorEvent.channels || []).includes(channel)).length;
  score += Math.min(channelOverlap / 4, 1) * 0.2;

  const actorOverlap = (event.actorTags || []).filter((actor) => (priorEvent.actorTags || []).includes(actor)).length;
  score += Math.min(actorOverlap / 2, 1) * 0.15;

  score += event.severity === priorEvent.severity ? 0.1 : 0;
  score += event.novelty === priorEvent.novelty ? 0.05 : 0;
  score += event.eventClass === priorEvent.eventClass ? 0.1 : 0;

  return Number(score.toFixed(4));
}

function buildSimilarityContext(event, priorEvent) {
  return {
    eventTypeMatched: event.eventType === priorEvent.eventType,
    regionMatched: event.region === priorEvent.region,
    channelOverlap: (event.channels || []).filter((channel) => (priorEvent.channels || []).includes(channel)),
    actorOverlap: (event.actorTags || []).filter((actor) => (priorEvent.actorTags || []).includes(actor)),
    severityMatched: event.severity === priorEvent.severity,
    noveltyMatched: event.novelty === priorEvent.novelty,
    eventClassMatched: event.eventClass === priorEvent.eventClass
  };
}

async function findMatches(event, limit = 10) {
  const priorEvents = await historicalEventStore.getRecentEvents({
    excludeEventKey: event.eventKey,
    eventClass: event.eventClass,
    region: event.region
  });

  return priorEvents
    .map((priorEvent) => ({
      matchContext: buildSimilarityContext(event, {
        eventType: priorEvent.event_type || priorEvent.eventType,
        region: priorEvent.region,
        channels: priorEvent.channels || [],
        actorTags: priorEvent.actor_tags || priorEvent.actorTags || [],
        severity: priorEvent.severity,
        novelty: priorEvent.novelty,
        eventClass: priorEvent.event_class || priorEvent.eventClass
      }),
      priorEvent,
      similarityScore: computeSimilarity(event, {
        eventType: priorEvent.event_type || priorEvent.eventType,
        region: priorEvent.region,
        channels: priorEvent.channels || [],
        actorTags: priorEvent.actor_tags || priorEvent.actorTags || [],
        severity: priorEvent.severity,
        novelty: priorEvent.novelty,
        eventClass: priorEvent.event_class || priorEvent.eventClass
      })
    }))
    .filter((entry) => entry.similarityScore > 0.2)
    .sort((left, right) => right.similarityScore - left.similarityScore)
    .slice(0, limit);
}

/**
 * Returns reaction_stats for the given event + instrument by looking up
 * historical outcome data.  Falls back to a safe default when there is
 * insufficient data so scoreEvent() keeps working unchanged.
 *
 * Shape (matches what confidenceCalibrator.scoreEvent() expects):
 *   { instrument, consistencyScore, samples?, hitRate?, avgMove? }
 */
async function buildReactionStats(event, instrument) {
  const stats = await historicalEventStore.getOutcomeStats({
    eventType: event.eventType,
    instrument,
    horizon: '1h',
    minSamples: 3,
  });

  if (!stats) {
    // No sufficient data yet — zero consistency triggers low_history_penalty
    // inside confidenceCalibrator (correct behaviour while data accumulates).
    return { instrument, consistencyScore: 0 };
  }

  return {
    instrument,
    consistencyScore: stats.consistencyScore,
    samples:          stats.samples,
    hitRate:          stats.hitRate,
    avgMove:          stats.avgMove,
  };
}

module.exports = {
  findMatches,
  computeSimilarity,
  buildReactionStats,
};
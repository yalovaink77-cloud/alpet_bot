const md5 = require('md5');
const { enrichClassification } = require('./eventClassifier');
const { extractImpactChannels } = require('./impactChannelExtractor');
const { mapChannelsToInstruments } = require('./turkeyExposureMapper');
const { validateNormalizedEvent } = require('../utils/schemaValidator');

function normalize(item) {
  const classification = enrichClassification(item);
  const channels = extractImpactChannels(classification);
  const candidateInstruments = mapChannelsToInstruments({
    ...classification,
    channels,
    title: item.title
  });

  const event = {
    eventKey: md5([item.sourceName, item.title, item.publishedAt].join('|')),
    eventClass: classification.eventClass,
    eventType: classification.eventType,
    sourceType: item.sourceType,
    sourceName: item.sourceName,
    publishedAt: new Date(item.publishedAt || Date.now()).toISOString(),
    detectedAt: new Date().toISOString(),
    title: item.title,
    summary: item.summary || item.title,
    region: classification.region,
    countryTags: classification.countryTags,
    actorTags: classification.actorTags,
    assetTags: classification.assetTags,
    channels,
    severity: classification.severity,
    novelty: classification.novelty,
    credibility: classification.credibility,
    directnessToTurkey: classification.directnessToTurkey,
    candidateInstruments,
    historicalMatchRequired: classification.directnessToTurkey !== 'direct' || classification.eventClass === 'Geopolitics',
    executionBias: classification.executionBias,
    metadata: {
      reliabilityScore: item.reliabilityScore || 0,
      url: item.url || '',

      // NEWS_FEEDER_BOT pass-through (if available)
      sourceTier: item.sourceTier || null,
      confidenceScore: item.confidenceScore ?? null,
      importanceScore: item.importanceScore ?? null,
      signalDirection: item.signalDirection || null,
      rawData: item.rawData ?? null,
    }
  };

  return validateNormalizedEvent(event);
}

module.exports = {
  normalize
};
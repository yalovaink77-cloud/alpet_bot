const { z } = require('zod');

const normalizedEventSchema = z.object({
  eventKey: z.string(),
  eventClass: z.string(),
  eventType: z.string(),
  sourceType: z.string(),
  sourceName: z.string(),
  publishedAt: z.string(),
  detectedAt: z.string(),
  title: z.string(),
  summary: z.string(),
  region: z.string(),
  countryTags: z.array(z.string()),
  actorTags: z.array(z.string()),
  assetTags: z.array(z.string()),
  channels: z.array(z.string()),
  severity: z.enum(['low', 'medium', 'high', 'extreme']),
  novelty: z.enum(['new_information', 'developing_story', 'already_known']),
  credibility: z.enum(['low', 'medium', 'high']),
  directnessToTurkey: z.enum(['direct', 'indirect', 'thematic']),
  candidateInstruments: z.array(z.string()),
  historicalMatchRequired: z.boolean(),
  executionBias: z.enum(['long_bias', 'short_bias', 'mixed', 'watch_only']),
  metadata: z.record(z.any()).default({})
});

const scoreBreakdownSchema = z.object({
  sourceScore: z.number().int().min(0).max(15),
  credibilityScore: z.number().int().min(0).max(10),
  noveltyScore: z.number().int().min(0).max(15),
  severityScore: z.number().int().min(0).max(15),
  turkeyRelevanceScore: z.number().int().min(0).max(10),
  historicalSimilarityScore: z.number().int().min(0).max(15),
  historicalConsistencyScore: z.number().int().min(0).max(10),
  instrumentAlignmentScore: z.number().int().min(0).max(5),
  timingScore: z.number().int().min(0).max(5),
  penaltyScore: z.number().int().min(0).max(100),
  finalScore: z.number().int().min(0).max(100),
  penaltyFlags: z.object({
    alreadyPricedPenalty: z.boolean(),
    singleSourcePenalty: z.boolean(),
    thematicOnlyPenalty: z.boolean(),
    lowHistoryPenalty: z.boolean(),
    contradictoryHistoryPenalty: z.boolean(),
    executionRiskPenalty: z.boolean(),
    portfolioCrowdingPenalty: z.boolean()
  })
});

const signalSchema = z.object({
  instrument: z.string(),
  decision: z.enum(['IGNORE', 'WATCH', 'EXECUTE']),
  direction: z.enum(['LONG', 'SHORT', 'WATCH', 'NONE']),
  finalScore: z.number().int().min(0).max(100),
  tradeConfidence: z.number().min(0).max(1),
  scoreBreakdown: scoreBreakdownSchema,
  explanation: z.record(z.any())
});

function validateNormalizedEvent(input) {
  return normalizedEventSchema.parse(input);
}

function validateSignal(input) {
  return signalSchema.parse(input);
}

module.exports = {
  normalizedEventSchema,
  scoreBreakdownSchema,
  signalSchema,
  validateNormalizedEvent,
  validateSignal
};
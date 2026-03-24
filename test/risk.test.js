const test = require('node:test');
const assert = require('node:assert/strict');

const { applyToSignal } = require('../src/risk/riskGuard');

function buildSignal(overrides = {}) {
  return {
    instrument: 'VIOP30',
    decision: 'EXECUTE',
    direction: 'SHORT',
    finalScore: 86,
    tradeConfidence: 0.86,
    scoreBreakdown: {
      sourceScore: 15,
      credibilityScore: 10,
      noveltyScore: 15,
      severityScore: 12,
      turkeyRelevanceScore: 10,
      historicalSimilarityScore: 10,
      historicalConsistencyScore: 6,
      instrumentAlignmentScore: 5,
      timingScore: 5,
      penaltyScore: 2,
      finalScore: 86,
      penaltyFlags: {
        alreadyPricedPenalty: false,
        singleSourcePenalty: false,
        thematicOnlyPenalty: false,
        lowHistoryPenalty: false,
        contradictoryHistoryPenalty: false,
        executionRiskPenalty: false,
        portfolioCrowdingPenalty: false
      }
    },
    explanation: {
      eventType: 'global_risk_off'
    },
    ...overrides
  };
}

test('risk guard downgrades execution when daily loss breaches limit', () => {
  const adjusted = applyToSignal(buildSignal(), {
    dailyLossPct: 4,
    drawdownPct: 2,
    openPositions: []
  });

  assert.equal(adjusted.decision, 'WATCH');
  assert.equal(adjusted.finalScore, 61);
  assert.equal(adjusted.scoreBreakdown.penaltyFlags.executionRiskPenalty, true);
  assert.equal(adjusted.explanation.riskPenaltyApplied, 25);
});

test('risk guard applies crowding penalty and preserves non-ignore decision when still above watch threshold', () => {
  const adjusted = applyToSignal(buildSignal(), {
    dailyLossPct: 0,
    drawdownPct: 0,
    openPositions: [{ instrument: 'VIOP30' }]
  });

  assert.equal(adjusted.decision, 'WATCH');
  assert.equal(adjusted.finalScore, 71);
  assert.equal(adjusted.scoreBreakdown.penaltyFlags.portfolioCrowdingPenalty, true);
  assert.equal(adjusted.explanation.crowdingCount, 1);
});
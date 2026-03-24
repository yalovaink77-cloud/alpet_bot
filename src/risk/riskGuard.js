const { evaluatePortfolioCrowding } = require('./portfolioExposureGuard');
const { APP_CONFIG } = require('../../config/app');

function chooseDecision(finalScore) {
  if (finalScore >= APP_CONFIG.thresholds.execute) {
    return 'EXECUTE';
  }

  if (finalScore >= APP_CONFIG.thresholds.watch) {
    return 'WATCH';
  }

  return 'IGNORE';
}

function evaluate(signal, accountState = {}) {
  const dailyLossPct = accountState.dailyLossPct || 0;
  const drawdownPct = accountState.drawdownPct || 0;
  const openPositions = accountState.openPositions || [];
  const crowding = evaluatePortfolioCrowding(openPositions, signal);

  const checks = {
    dailyLoss: dailyLossPct < APP_CONFIG.risk.maxDailyLossPct,
    drawdown: drawdownPct < APP_CONFIG.risk.maxDrawdownPct,
    maxOpenPositions: openPositions.length < APP_CONFIG.risk.maxOpenPositions,
    portfolioCrowding: crowding.allowed
  };

  return {
    allClear: Object.values(checks).every(Boolean),
    checks,
    crowdingCount: crowding.count
  };
}

function applyToSignal(signal, accountState = {}) {
  const evaluation = evaluate(signal, accountState);
  const penaltyFlags = {
    ...signal.scoreBreakdown.penaltyFlags,
    executionRiskPenalty: !evaluation.checks.dailyLoss || !evaluation.checks.drawdown || !evaluation.checks.maxOpenPositions,
    portfolioCrowdingPenalty: !evaluation.checks.portfolioCrowding
  };

  let extraPenalty = 0;

  if (penaltyFlags.executionRiskPenalty) {
    extraPenalty += 25;
  }

  if (penaltyFlags.portfolioCrowdingPenalty) {
    extraPenalty += 15;
  }

  const finalScore = Math.max(0, signal.finalScore - extraPenalty);
  const rescoredBreakdown = {
    ...signal.scoreBreakdown,
    penaltyScore: signal.scoreBreakdown.penaltyScore + extraPenalty,
    finalScore,
    penaltyFlags
  };

  const baseDecision = chooseDecision(finalScore);
  const decision = penaltyFlags.executionRiskPenalty && baseDecision === 'EXECUTE' ? 'WATCH' : baseDecision;
  const direction = decision === 'IGNORE' ? 'NONE' : signal.direction;

  return {
    ...signal,
    decision,
    direction,
    finalScore,
    tradeConfidence: Number(Math.min(Math.max(finalScore / 100, 0), 1).toFixed(4)),
    scoreBreakdown: rescoredBreakdown,
    explanation: {
      ...signal.explanation,
      riskChecks: evaluation.checks,
      riskPenaltyApplied: extraPenalty,
      crowdingCount: evaluation.crowdingCount
    },
    risk: evaluation
  };
}

module.exports = {
  evaluate,
  applyToSignal
};
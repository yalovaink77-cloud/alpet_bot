const { buildReactionStats: buildFromOutcomes } = require('./historicalEventMatcher');

async function buildReactionStats(event, matches) {
  const instruments = event.candidateInstruments || [];
  const sampleSize  = matches.length;

  // Compute stats for each instrument — prefer real outcome data, fall back to
  // heuristic formula when there are fewer than 3 labeled outcomes yet.
  const stats = await Promise.all(instruments.map(async (instrument) => {
    // Try real outcome data first
    const outcomeStats = await buildFromOutcomes(event, instrument);

    let consistencyScore;
    let sameDirectionRatio1d;
    let medianMove1d  = 0;
    let medianMove3d  = 0;

    if (outcomeStats && outcomeStats.consistencyScore > 0) {
      // Real data available — use it directly
      consistencyScore     = outcomeStats.consistencyScore;
      sameDirectionRatio1d = outcomeStats.hitRate ?? outcomeStats.consistencyScore;
      medianMove1d         = outcomeStats.avgMove ?? 0;
      medianMove3d         = medianMove1d * 1.5;
    } else {
      // Heuristic fallback while outcome data accumulates
      const d1s = matches.map(m => m.assets?.find(a => a.name === instrument)?.d1).filter(Boolean);
      const d3s = matches.map(m => m.assets?.find(a => a.name === instrument)?.d3).filter(Boolean);
      const meanMove1d   = d1s.length ? d1s.reduce((a, b) => a + b, 0) / d1s.length : 0;
      const meanMove3d   = d3s.length ? d3s.reduce((a, b) => a + b, 0) / d3s.length : 0;
      const meanConsist  = d1s.length ? d1s.filter(x => x > 0).length / d1s.length : 0;
      const baseCons     = sampleSize >= 5 ? 0.75 : sampleSize >= 3 ? 0.55 : 0.3;
      const sameDirRatio = sampleSize ? Math.min(0.5 + sampleSize * 0.04, 0.85) : 0;

      consistencyScore     = Number((meanConsist || baseCons).toFixed(2));
      sameDirectionRatio1d = Number((meanConsist || sameDirRatio).toFixed(2));
      medianMove1d         = Number((meanMove1d  || sameDirRatio * 0.02).toFixed(4));
      medianMove3d         = Number((meanMove3d  || sameDirRatio * 0.03).toFixed(4));
    }

    return {
      instrument,
      sampleSize:           outcomeStats?.samples ?? sampleSize,
      sameDirectionRatio1d: Number(sameDirectionRatio1d.toFixed(2)),
      medianMove1d:         Number(medianMove1d.toFixed(4)),
      medianMove3d:         Number(medianMove3d.toFixed(4)),
      consistencyScore:     Number(consistencyScore.toFixed(2)),
      impactHorizon:        event.eventClass === 'Company / Disclosure Events' ? '1d' : 'intraday',
      outcomeDataAvailable: Boolean(outcomeStats && outcomeStats.consistencyScore > 0),
    };
  }));

  return stats;
}

module.exports = {
  buildReactionStats
};

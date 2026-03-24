function buildReactionStats(event, matches) {
  return (event.candidateInstruments || []).map((instrument) => {
    const sampleSize = matches.length;
    const baseConsistency = sampleSize >= 5 ? 0.75 : sampleSize >= 3 ? 0.55 : 0.3;
    const sameDirectionRatio = sampleSize ? Math.min(0.5 + sampleSize * 0.04, 0.85) : 0;

    return {
      instrument,
      sampleSize,
      sameDirectionRatio1d: Number(sameDirectionRatio.toFixed(2)),
      medianMove1d: sampleSize ? Number((sameDirectionRatio * 0.02).toFixed(4)) : 0,
      medianMove3d: sampleSize ? Number((sameDirectionRatio * 0.03).toFixed(4)) : 0,
      consistencyScore: Number(baseConsistency.toFixed(2)),
      impactHorizon: event.eventClass === 'Company / Disclosure Events' ? '1d' : 'intraday'
    };
  });
}

module.exports = {
  buildReactionStats
};
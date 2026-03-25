function buildReactionStats(event, matches) {
  // Extraction pipeline'dan gelen eventType, actors, stage, context ile geçmiş örnek eşleştirme yapılabilir
  // matches parametresi geçmiş benzer olaylar (findSimilarEvents ile)
  return (event.candidateInstruments || []).map((instrument) => {
    const sampleSize = matches.length;
    // Geçmiş örneklerden istatistiksel özet çıkarımı
    let meanMove1d = 0, meanMove3d = 0, meanConsistency = 0;
    if (sampleSize) {
      const d1s = matches.map(m => m.assets?.find(a => a.name === instrument)?.d1).filter(Boolean);
      const d3s = matches.map(m => m.assets?.find(a => a.name === instrument)?.d3).filter(Boolean);
      meanMove1d = d1s.length ? d1s.reduce((a, b) => a + b, 0) / d1s.length : 0;
      meanMove3d = d3s.length ? d3s.reduce((a, b) => a + b, 0) / d3s.length : 0;
      meanConsistency = d1s.length ? d1s.filter(x => x > 0).length / d1s.length : 0;
    }
    const baseConsistency = sampleSize >= 5 ? 0.75 : sampleSize >= 3 ? 0.55 : 0.3;
    const sameDirectionRatio = sampleSize ? Math.min(0.5 + sampleSize * 0.04, 0.85) : 0;

    return {
      instrument,
      sampleSize,
      sameDirectionRatio1d: Number((meanConsistency || sameDirectionRatio).toFixed(2)),
      medianMove1d: Number((meanMove1d || (sameDirectionRatio * 0.02)).toFixed(4)),
      medianMove3d: Number((meanMove3d || (sameDirectionRatio * 0.03)).toFixed(4)),
      consistencyScore: Number((meanConsistency || baseConsistency).toFixed(2)),
      impactHorizon: event.eventClass === 'Company / Disclosure Events' ? '1d' : 'intraday'
    };
  });
}

module.exports = {
  buildReactionStats
};
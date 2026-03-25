// news_signal_integration.test.js
// Extraction pipeline'dan sinyal üretimine uçtan uca test
const { extractEventEntities } = require('../src/utils/eventExtractor');
const { buildReactionStats } = require('../src/analyzers/marketReactionAnalyzer');
const { buildSignals } = require('../src/analyzers/decisionEngine');

(async () => {
  // Örnek haber: Ortadoğu'da savaş başladı
  const newsText = 'ABD ve İran arasında Basra Körfezi’nde askeri çatışma başladı. Petrol fiyatları yükselişe geçti.';
  const extraction = await extractEventEntities(newsText);
  console.log('Extraction:', extraction);

  // Varsayalım ki geçmişte benzer 3 olay var (dummy data)
  const matches = [
    { assets: [{ name: 'BRENT', d1: 0.04, d3: 0.06 }] },
    { assets: [{ name: 'BRENT', d1: 0.03, d3: 0.05 }] },
    { assets: [{ name: 'BRENT', d1: 0.05, d3: 0.07 }] }
  ];

  // Olaydan etkilenen enstrümanlar
  extraction.candidateInstruments = ['BRENT', 'BIST30', 'XAUUSD'];

  // Piyasa etkisi analizi
  const reactionStats = buildReactionStats(extraction, matches);
  console.log('Reaction Stats:', reactionStats);

  // Sinyal üretimi
  const signals = buildSignals(extraction, reactionStats, matches);
  console.log('Signals:', signals);
})();

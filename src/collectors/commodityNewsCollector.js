/**
 * Commodity News Collector
 * Reuters, EIA, BBC Business, OPEC kaynaklarından petrol/altın/enerji haberleri çeker.
 * Tetiklediği enstrümanlar: BRENT, XAUUSD, KOZAL, TUPRS, THYAO, PGSUS
 */

const Parser = require('rss-parser');
const { SOURCE_CONFIG } = require('../../config/sources');
const logger = require('../utils/logger');

const parser = new Parser();

// Filtre: sadece petrol/altın/enerji/emtia ile ilgili haberleri tut
const COMMODITY_KEYWORDS = [
  'oil', 'crude', 'brent', 'wti', 'opec', 'petrol', 'enerji', 'energy',
  'gold', 'altın', 'xau', 'precious metal', 'silver', 'gümüş',
  'natural gas', 'doğalgaz', 'lng', 'fuel',
  'commodity', 'emtia', 'inflation', 'enflasyon', 'supply', 'demand',
  'thyao', 'tuprs', 'pgsus', 'kozal', 'tüpraş', 'turk hava', 'pegasus'
];

function isRelevant(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  return COMMODITY_KEYWORDS.some(kw => text.includes(kw));
}

async function fetchSource(sourceConfig) {
  try {
    const feed = await parser.parseURL(sourceConfig.url);
    const items = (feed.items || []).slice(0, 15);
    const relevant = items.filter(item =>
      isRelevant(item.title || '', item.contentSnippet || item.content || '')
    );
    logger.info(`Commodity collector: ${sourceConfig.sourceName} (${relevant.length}/${items.length} ilgili)`);
    return relevant.map(item => ({
      sourceType: sourceConfig.sourceType,
      sourceName: sourceConfig.sourceName,
      title: item.title || 'Untitled',
      summary: item.contentSnippet || item.content || item.title || '',
      url: item.link || '',
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      reliabilityScore: sourceConfig.reliabilityScore,
      credibility: sourceConfig.credibility
    }));
  } catch (error) {
    logger.warn(`Commodity collector: ${sourceConfig.sourceName} başarısız`, { error: error.message });
    return [];
  }
}

async function fetchAll() {
  const sources = [
    SOURCE_CONFIG.reuters,
    SOURCE_CONFIG.eia,
    SOURCE_CONFIG.bbc_business,
    SOURCE_CONFIG.opec
  ];
  const results = await Promise.all(sources.map(fetchSource));
  return results.flat();
}

module.exports = {
  fetchAll
};

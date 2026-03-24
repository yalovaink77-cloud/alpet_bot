const Parser = require('rss-parser');
const { SOURCE_CONFIG } = require('../../config/sources');
const logger = require('../utils/logger');

const parser = new Parser();

async function fetchSource(sourceConfig) {
  try {
    const feed = await parser.parseURL(sourceConfig.url);
    return (feed.items || []).slice(0, 10).map((item) => ({
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
    logger.warn(`Failed to fetch ${sourceConfig.sourceName}`, { error: error.message });
    return [];
  }
}

async function fetchAll() {
  const sources = [SOURCE_CONFIG.aa, SOURCE_CONFIG.bloomberght];
  const results = await Promise.all(sources.map(fetchSource));
  return results.flat();
}

module.exports = {
  fetchAll
};
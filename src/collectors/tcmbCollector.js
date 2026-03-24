const axios = require('axios');
const cheerio = require('cheerio');
const { SOURCE_CONFIG } = require('../../config/sources');
const logger = require('../utils/logger');

function buildAbsoluteUrl(pathname) {
  if (!pathname) {
    return SOURCE_CONFIG.tcmb.url;
  }

  if (pathname.startsWith('http')) {
    return pathname;
  }

  return new URL(pathname, SOURCE_CONFIG.tcmb.url).toString();
}

function looksRelevantAnnouncement(title) {
  return /(faiz|para politikasi|enflasyon|duyuru|merkez bankasi|tcmb|press release|monetary)/i.test(title);
}

function parseAnnouncements(html, publishedAt = new Date().toISOString()) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const items = [];

  $('a').each((_, element) => {
    const title = $(element).text().replace(/\s+/g, ' ').trim();
    const href = $(element).attr('href');
    if (!title || !href) {
      return;
    }

    if (!looksRelevantAnnouncement(title)) {
      return;
    }

    const url = buildAbsoluteUrl(href);
    const dedupKey = `${title}|${url}`;
    if (seen.has(dedupKey)) {
      return;
    }

    seen.add(dedupKey);
    items.push({
      sourceType: SOURCE_CONFIG.tcmb.sourceType,
      sourceName: SOURCE_CONFIG.tcmb.sourceName,
      title,
      summary: title,
      url,
      publishedAt,
      reliabilityScore: SOURCE_CONFIG.tcmb.reliabilityScore,
      credibility: SOURCE_CONFIG.tcmb.credibility
    });
  });

  return items.slice(0, 10);
}

async function fetchAll() {
  try {
    const response = await axios.get(SOURCE_CONFIG.tcmb.url, { timeout: 15000 });
    return parseAnnouncements(response.data);
  } catch (error) {
    logger.warn('Failed to fetch TCMB announcements', { error: error.message });
    return [];
  }
}

module.exports = {
  fetchAll,
  parseAnnouncements,
  looksRelevantAnnouncement,
  buildAbsoluteUrl
};
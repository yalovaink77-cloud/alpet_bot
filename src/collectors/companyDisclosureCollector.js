const https = require('https');
const cheerio = require('cheerio');
const { SOURCE_CONFIG } = require('../../config/sources');
const logger = require('../utils/logger');

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
      }
    }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        response.resume();
        return;
      }

      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => resolve(data));
    });

    request.on('error', reject);
    request.end();
  });
}

function buildAbsoluteUrl(pathname) {
  if (!pathname) {
    return SOURCE_CONFIG.kap.url;
  }

  if (pathname.startsWith('http')) {
    return pathname;
  }

  return new URL(pathname, SOURCE_CONFIG.kap.url).toString();
}

function looksLikeDisclosure(title) {
  return /(ozel durum|material event|geri alim|geri alin|buy-back|new business|genel kurul|sermaye|kar payi|dividend|pay al|pay sat|finansal duran varlik|notification|disclosure|ihale|sozlesme|share buy-back|insider|yeni is iliskisi)/i.test(title);
}

function parseDisclosures(html, publishedAt = new Date().toISOString()) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const disclosures = [];

  $('a').each((_, element) => {
    const title = $(element).text().replace(/\s+/g, ' ').trim();
    const href = $(element).attr('href');
    if (!title || !looksLikeDisclosure(title)) {
      return;
    }

    const url = buildAbsoluteUrl(href);
    const dedupKey = `${title}|${url}`;
    if (seen.has(dedupKey)) {
      return;
    }

    seen.add(dedupKey);
    disclosures.push({
      sourceType: 'disclosure',
      sourceName: 'KAP',
      title,
      summary: title,
      url,
      publishedAt,
      reliabilityScore: 15,
      credibility: 'high'
    });
  });

  return disclosures.slice(0, 20).map((item) => ({
    sourceType: 'disclosure',
    sourceName: 'KAP',
    title: item.title || 'Untitled disclosure',
    summary: item.summary || item.title || '',
    url: item.url || '',
    publishedAt: item.publishedAt || publishedAt,
    reliabilityScore: item.reliabilityScore || 15,
    credibility: item.credibility || 'high'
  }));
}

async function fetchAll() {
  try {
    const html = await fetchHtml(SOURCE_CONFIG.kap.url);
    return parseDisclosures(html);
  } catch (error) {
    logger.warn('Failed to fetch KAP disclosures', { error: error.message });
    return [];
  }
}

module.exports = {
  fetchAll,
  parseDisclosures,
  looksLikeDisclosure,
  buildAbsoluteUrl
};
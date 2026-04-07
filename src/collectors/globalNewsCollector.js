/**
 * Global News Collector — Supabase Bridge
 * NEWS_FEEDER_BOT'un topladığı haberleri Supabase news tablosundan okur.
 * Son 6 dakikadaki haberleri çeker (5 dk cycle + 1 dk overlap).
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// NEWS_FEEDER_BOT source_weight → alpet_bot reliabilityScore dönüşümü
const SOURCE_WEIGHT_MAP = {
  'KAP':              15,
  'Bloomberg HT':     13,
  'Anadolu Agency':   12,
  'TCMB':             15,
  'Reuters':          14,
  'BBC':              12,
  'OilPrice':         11,
  'MarketWatch':      12,
};

function toReliabilityScore(source, sourceWeight) {
  return SOURCE_WEIGHT_MAP[source] || Math.round((sourceWeight || 0.5) * 15);
}

function toCredibility({ sourceTier, confidenceScore }) {
  // NEWS_FEEDER_BOT tiers: tier_1..tier_4, confidence_score: 0..1
  const tier = (sourceTier || 'tier_2').toLowerCase();
  const conf = Number(confidenceScore);
  if (tier === 'tier_1') return 'high';
  if (tier === 'tier_2' && Number.isFinite(conf) && conf >= 0.45) return 'high';
  if (tier === 'tier_4') return 'low';
  return 'medium';
}

async function fetchAll() {
  try {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data, error } = await sb
      .from('news')
      .select('id, source, title, content, url, published_at, source_weight, source_tier, confidence_score, importance_score, signal_direction, raw_data, category, event_type, keywords, affected_assets, language')
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.warn('GlobalNewsCollector: Supabase sorgu hatası', { error: error.message });
      return [];
    }

    logger.info(`GlobalNewsCollector: ${data.length} haber Supabase'den çekildi`);

    const { extractEventEntities } = require('../utils/eventExtractor');
    return Promise.all(data.map(async row => {
      const newsText = `${row.title || ''} ${row.content || ''}`;
      const extraction = await extractEventEntities(newsText);
      return {
        sourceType:       'supabase',
        sourceName:       row.source || 'Unknown',
        externalId:       String(row.id),
        title:            row.title || '',
        summary:          row.content || row.title || '',
        url:              row.url || '',
        publishedAt:      row.published_at || new Date().toISOString(),
        reliabilityScore: toReliabilityScore(row.source, row.source_weight),
        credibility:      toCredibility({ sourceTier: row.source_tier, confidenceScore: row.confidence_score }),
        category:         row.category || 'general',
        eventType:        extraction?.eventType || row.event_type || 'news',
        keywords:         row.keywords || [],
        affectedAssets:   row.affected_assets || [],
        language:         row.language || 'tr',
        actors:           extraction?.actors || [],
        eventStage:       extraction?.stage || null,
        eventContext:     extraction?.context || {},
        eventMagnitude:   extraction?.magnitude || null,

        // Extra fields produced by NEWS_FEEDER_BOT normalizer (pass-through)
        sourceTier:       row.source_tier || null,
        confidenceScore:  row.confidence_score ?? null,
        importanceScore:  row.importance_score ?? null,
        signalDirection:  row.signal_direction || null,
        rawData:          row.raw_data ?? null,
      };
    }));
  } catch (err) {
    logger.warn('GlobalNewsCollector: Beklenmeyen hata', { error: err.message });
    return [];
  }
}

module.exports = {
  fetchAll
};

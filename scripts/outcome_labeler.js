/**
 * scripts/outcome_labeler.js
 *
 * Resolves pending event_signals into event_outcomes by fetching the actual
 * price move that occurred after the signal was generated.
 *
 * Horizons resolved: 1h, 4h, 1d
 *
 * Price source: Yahoo Finance (free, no API key required).
 * Symbol mapping: ALPET instrument → Yahoo Finance ticker.
 *
 * Usage (run manually or via cron after each BIST/FX session close):
 *   node scripts/outcome_labeler.js
 *
 * Cron example (every day at 19:00 Istanbul time, after BIST close):
 *   0 19 * * 1-5 cd /path/to/alpet_bot && node scripts/outcome_labeler.js
 */

require('dotenv').config();
const axios         = require('axios');
const supabaseClient = require('../src/storage/supabaseClient');
const logger        = require('../src/utils/logger');

// ── Instrument → Yahoo Finance symbol ────────────────────────────────────────
const YAHOO_SYMBOLS = {
  USDTRY: 'TRY=X',
  XAUUSD: 'GC=F',
  BRENT:  'BZ=F',
  VIOP30: 'XU030.IS',
  THYAO:  'THYAO.IS',
  PGSUS:  'PGSUS.IS',
  TUPRS:  'TUPRS.IS',
  KOZAL:  'KOZAL.IS',
  GARAN:  'GARAN.IS',
  AKBNK:  'AKBNK.IS',
};

// ── Horizon config ────────────────────────────────────────────────────────────
const HORIZONS = [
  { label: '1h',  minAgeMinutes: 55,  maxAgeMinutes: 120  },
  { label: '4h',  minAgeMinutes: 230, maxAgeMinutes: 300  },
  { label: '1d',  minAgeMinutes: 1380, maxAgeMinutes: 1560 },
];

// ── Yahoo Finance price fetcher ───────────────────────────────────────────────
async function fetchCurrentPrice(instrument) {
  const symbol = YAHOO_SYMBOLS[instrument];
  if (!symbol) {
    logger.warn(`outcome_labeler: no Yahoo symbol for instrument ${instrument}`);
    return null;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const { data } = await axios.get(url, {
      params: { interval: '1m', range: '5m' },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
    });

    const result = data?.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close;
    if (!closes || closes.length === 0) return null;

    // Most recent non-null close
    const price = [...closes].reverse().find(v => v != null);
    return price ?? null;
  } catch (err) {
    logger.warn(`outcome_labeler: price fetch failed for ${instrument}: ${err.message}`);
    return null;
  }
}

// ── Fetch the reference price at signal creation time from closed trades ──────
// If no closed trade exists, fall back to open_price in any trade record.
async function fetchReferencePrice(supabase, signalId) {
  if (!supabase.enabled) return null;

  const { data, error } = await supabase.client
    .from('trades')
    .select('open_price, close_price, status')
    .eq('signal_id', signalId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0].open_price ?? null;
}

// ── Core labeling logic ───────────────────────────────────────────────────────
async function labelHorizon({ label, minAgeMinutes, maxAgeMinutes }) {
  logger.info(`outcome_labeler: resolving horizon=${label}`);

  const signals = await supabaseClient.listSignalsForLabeling({
    minAgeMinutes,
    maxAgeMinutes,
    horizon: label,
  });

  logger.info(`outcome_labeler: ${signals.length} signals pending for ${label}`);

  let saved = 0;
  for (const signal of signals) {
    try {
      const currentPrice   = await fetchCurrentPrice(signal.instrument);
      const referencePrice = await fetchReferencePrice(supabaseClient, signal.id);

      if (!currentPrice || !referencePrice) {
        logger.warn(`outcome_labeler: skipping ${signal.id} — missing price data`);
        continue;
      }

      const realizedMove = (currentPrice - referencePrice) / referencePrice;

      await supabaseClient.saveOutcome({
        event_id:         signal.event_id,
        signal_id:        signal.id,
        instrument:       signal.instrument,
        outcome_horizon:  label,
        direction:        signal.direction,
        realized_move:    Number(realizedMove.toFixed(6)),
        benchmark_move:   null,   // can be filled with VIOP30/XU100 return if needed
        pnl:              null,   // filled by paperPortfolio on close
        metadata: {
          reference_price: referencePrice,
          current_price:   currentPrice,
          resolved_at:     new Date().toISOString(),
        },
      });

      saved++;
    } catch (err) {
      logger.error(`outcome_labeler: error for signal ${signal.id}: ${err.message}`);
    }
  }

  logger.info(`outcome_labeler: saved ${saved}/${signals.length} outcomes for ${label}`);
  return saved;
}

async function run() {
  if (!supabaseClient.enabled) {
    logger.error('outcome_labeler: Supabase not configured, exiting');
    process.exit(1);
  }

  for (const horizon of HORIZONS) {
    await labelHorizon(horizon);
  }

  logger.info('outcome_labeler: done');
  process.exit(0);
}

run().catch(err => {
  logger.error('outcome_labeler: fatal', err);
  process.exit(1);
});

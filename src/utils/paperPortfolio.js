/**
 * Paper Portfolio Manager
 * 40$ sanal bakiye ile simülasyon trade yönetimi.
 * Pozisyon açar, kapatır, P&L hesaplar, Supabase'e kaydeder.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { getPrice, getRecentCloses } = require('./priceOracle');
const logger = require('./logger');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Her işlemde bakiyenin max %10'unu riske at
const POSITION_SIZE_PCT = 0.10;
// Stop-loss: giriş fiyatından %1.5 ters giderse kapat (R/R = 1:3)
const STOP_LOSS_PCT = 0.025;  // FIX: 1.5% → 2.5% (pazartesi volatilitesi)
// Take-profit: giriş fiyatından %4.5 kâra gelince kapat (R/R = 1:3)
const TAKE_PROFIT_PCT = 0.06;  // FIX: 4.5% → 6% (daha makul R/R)
// Breakeven stop: pozisyon bu kâra ulaşırsa stop entry'ye çekilir
const BREAKEVEN_TRIGGER_PCT = 0.01;
// Gece saatlerinde (UTC 20:00–06:00) volatil enstrümanlara yeni giriş yapma
const OVERNIGHT_RESTRICTED = ['BRENT', 'XAUUSD', 'VIOP30', 'GARAN', 'AKBNK'];  // FIX: gece volatil hisse ekle
// Trend filtresi: son 3 günün ortalamasına göre ters yönde giriş yapma
const TREND_FILTER_DAYS = 3;
// Pozisyon zaman aşımı: açık kalabilecek maksimum saat
const MAX_OPEN_HOURS = 12;  // FIX: 48h → 12h (hafta sonu gap)
// Arka arkaya bu kadar stop-loss gelirse o enstrümana yeni giriş yapma
const MAX_CONSECUTIVE_LOSSES = 3;

// ── Performance gating (kazanç optimizasyonu) ─────────────────────────────────
// Yeterli örneklem oluşunca (min trade) negatif performanslı enstrümanlarda
// yeni girişleri otomatik kıs.
const PAPER_GATING_ENABLED = process.env.PAPER_GATING_ENABLED !== 'false';
const PAPER_GATING_MIN_TRADES = Number(process.env.PAPER_GATING_MIN_TRADES) || 20;
const PAPER_GATING_MIN_WINRATE = Number(process.env.PAPER_GATING_MIN_WINRATE) || 0.40; // 0–1
const PERF_CACHE_MS = Number(process.env.PAPER_PERF_CACHE_MS) || 5 * 60 * 1000;
let perfCache = { at: 0, byInstrument: {} };

async function getClosedPerformanceByInstrument() {
  const now = Date.now();
  if (perfCache.at && now - perfCache.at < PERF_CACHE_MS) return perfCache.byInstrument;

  const { data, error } = await sb
    .from('paper_positions')
    .select('instrument,pnl_usd,status')
    .eq('status', 'closed')
    .limit(5000);

  if (error) {
    logger.warn('paperPortfolio: performans geçmişi okunamadı', { error: error.message });
    return perfCache.byInstrument || {};
  }

  const by = {};
  for (const row of data || []) {
    const inst = row.instrument;
    const pnl = Number(row.pnl_usd || 0);
    if (!by[inst]) by[inst] = { trades: 0, wins: 0, pnlSum: 0 };
    by[inst].trades += 1;
    if (pnl > 0) by[inst].wins += 1;
    by[inst].pnlSum += pnl;
  }

  // finalize
  Object.keys(by).forEach((k) => {
    const s = by[k];
    const winRate = s.trades ? s.wins / s.trades : 0;
    by[k] = {
      ...s,
      winRate: Number(winRate.toFixed(4)),
      avgPnl: Number((s.pnlSum / Math.max(1, s.trades)).toFixed(4)),
    };
  });

  perfCache = { at: now, byInstrument: by };
  return by;
}

async function getAccount() {
  const { data, error } = await sb
    .from('paper_account')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) { logger.warn('paperPortfolio: hesap okunamadı', { error: error.message }); return null; }
  return data;
}

async function openPosition(signal) {
  const account = await getAccount();
  if (!account) return null;

  if (account.balance_usd < 2) {
    logger.warn('paperPortfolio: yetersiz bakiye', { balance: account.balance_usd });
    return null;
  }

  // Performans kapısı: yeterli trade varsa ve performans kötüyse yeni giriş engelle
  if (PAPER_GATING_ENABLED) {
    const perf = await getClosedPerformanceByInstrument();
    const s = perf[signal.instrument];
    if (s && s.trades >= PAPER_GATING_MIN_TRADES) {
      const bad = s.pnlSum < 0 && s.winRate < PAPER_GATING_MIN_WINRATE;
      if (bad) {
        logger.warn(
          `paperPortfolio: ${signal.instrument} geçmiş performansı zayıf (trades=${s.trades} winRate=${Math.round(s.winRate * 100)}% pnl=$${s.pnlSum.toFixed(2)}), giriş engellendi`
        );
        return null;
      }
    }
  }

  // Aynı enstrümanda açık pozisyon var mı?
  const { data: existing } = await sb
    .from('paper_positions')
    .select('id')
    .eq('instrument', signal.instrument)
    .eq('status', 'open')
    .limit(1);

  if (existing && existing.length > 0) {
    logger.info(`paperPortfolio: ${signal.instrument} zaten açık pozisyon var, atlanıyor`);
    return null;
  }

  // Aynı enstrümanda son MAX_CONSECUTIVE_LOSSES işlem arka arkaya stop-loss mu?
  const { data: recentClosed } = await sb
    .from('paper_positions')
    .select('close_reason')
    .eq('instrument', signal.instrument)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(MAX_CONSECUTIVE_LOSSES);

  if (recentClosed && recentClosed.length === MAX_CONSECUTIVE_LOSSES &&
      recentClosed.every(p => p.close_reason === 'STOP_LOSS')) {
    logger.warn(`paperPortfolio: ${signal.instrument} son ${MAX_CONSECUTIVE_LOSSES} işlem arka arkaya stop-loss, giriş engellendi`);
    return null;
  }

  const entryPrice = await getPrice(signal.instrument);
  if (!entryPrice) {
    logger.warn(`paperPortfolio: ${signal.instrument} fiyat alınamadı, pozisyon açılamıyor`);
    return null;
  }

  // Gece saati filtresi: kısıtlı enstrümanlarda UTC 20:00–06:00 arası giriş yapma
  if (OVERNIGHT_RESTRICTED.includes(signal.instrument)) {
    const utcHour = new Date().getUTCHours();
    if (utcHour >= 20 || utcHour < 6) {
      logger.warn(`paperPortfolio: ${signal.instrument} gece saati (UTC ${utcHour}:xx), yeni giriş engellendi`);
      return null;
    }
  }

  // Trend filtresi: son gün kapanışlarına bakarak ters yönde giriş yapma
  if (signal.direction === 'LONG' || signal.direction === 'SHORT') {
    const closes = await getRecentCloses(signal.instrument, TREND_FILTER_DAYS + 1);
    if (closes && closes.length >= 2) {
      const oldest = closes[0];
      const newest = closes[closes.length - 1];
      const trendPct = (newest - oldest) / oldest;
      // Trend güçlüyse (>%2) ve yöne karşıysa girme
      if (signal.direction === 'LONG' && trendPct < -0.02) {
        logger.warn(`paperPortfolio: ${signal.instrument} ${TREND_FILTER_DAYS}g trend -%${Math.abs(trendPct*100).toFixed(1)}, LONG giriş engellendi`);
        return null;
      }
      if (signal.direction === 'SHORT' && trendPct > 0.02) {
        logger.warn(`paperPortfolio: ${signal.instrument} ${TREND_FILTER_DAYS}g trend +%${(trendPct*100).toFixed(1)}, SHORT giriş engellendi`);
        return null;
      }
    }
  }

  const positionUsd = Math.min(
    parseFloat((account.balance_usd * POSITION_SIZE_PCT).toFixed(2)),
    account.balance_usd
  );

  const { data: position, error } = await sb
    .from('paper_positions')
    .insert({
      instrument:   signal.instrument,
      direction:    signal.direction,
      entry_price:  entryPrice,
      position_usd: positionUsd,
      signal_score: signal.finalScore,
      status:       'open'
    })
    .select()
    .single();

  if (error) {
    logger.warn('paperPortfolio: pozisyon açılamadı', { error: error.message });
    return null;
  }

  // Bakiyeden düş (pozisyon sermayeyi bloke eder)
  const newBalance = parseFloat((account.balance_usd - positionUsd).toFixed(2));
  await sb.from('paper_account').update({
    balance_usd: newBalance,
    updated_at:  new Date().toISOString()
  }).eq('id', 1);

  logger.info(`paperPortfolio: AÇILDI ${signal.instrument} ${signal.direction} @ ${entryPrice} ($${positionUsd}) | Bakiye: $${newBalance}`);
  return { position, entryPrice, positionUsd };
}

async function checkAndClosePositions() {
  const { data: openPositions, error } = await sb
    .from('paper_positions')
    .select('*')
    .eq('status', 'open');

  if (error || !openPositions || openPositions.length === 0) return [];

  const closed = [];

  for (const pos of openPositions) {
    const currentPrice = await getPrice(pos.instrument);
    if (!currentPrice) continue;

    const entry = parseFloat(pos.entry_price);
    const pricePct = (currentPrice - entry) / entry;

    // WATCH yönü belirsiz pozisyonlar hesaplanamaz, atla
    if (pos.direction === 'WATCH' || pos.direction === 'NONE') continue;

    // LONG: fiyat arttıysa kâr, düştüyse zarar
    // SHORT: fiyat düştüyse kâr, arttıysa zarar
    const pnlPct = pos.direction === 'LONG' ? pricePct : -pricePct;
    const pnlUsd = parseFloat((pos.position_usd * pnlPct).toFixed(2));

    // Breakeven stop: kâr BREAKEVEN_TRIGGER_PCT'ye ulaştıysa ve şimdi sıfırın altındaysa kapat
    const hasTriggeredBreakeven = pos.breakeven_triggered || pnlPct >= BREAKEVEN_TRIGGER_PCT;
    if (hasTriggeredBreakeven && !pos.breakeven_triggered) {
      await sb.from('paper_positions').update({ breakeven_triggered: true }).eq('id', pos.id);
    }

    let closeReason = null;
    if (hasTriggeredBreakeven && pnlPct <= 0) closeReason = 'BREAKEVEN_STOP';
    else if (pnlPct <= -STOP_LOSS_PCT) closeReason = 'STOP_LOSS';
    else if (pnlPct >= TAKE_PROFIT_PCT) closeReason = 'TAKE_PROFIT';
    else {
      // 48 saat zaman aşımı kontrolü
      const openedAt = new Date(pos.opened_at);
      const hoursOpen = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60);
      if (hoursOpen >= MAX_OPEN_HOURS) closeReason = 'TIMEOUT';
    }

    if (closeReason) {
      await sb.from('paper_positions').update({
        status:       'closed',
        exit_price:   currentPrice,
        pnl_usd:      pnlUsd,
        closed_at:    new Date().toISOString(),
        close_reason: closeReason
      }).eq('id', pos.id);

      // Bakiyeyi güncelle
      const account = await getAccount();
      if (account) {
        const newBalance = parseFloat((account.balance_usd + pos.position_usd + pnlUsd).toFixed(2));
        const isWin = pnlUsd > 0;
        await sb.from('paper_account').update({
          balance_usd:    newBalance,
          total_trades:   account.total_trades + 1,
          winning_trades: account.winning_trades + (isWin ? 1 : 0),
          updated_at:     new Date().toISOString()
        }).eq('id', 1);
      }

      logger.info(`paperPortfolio: KAPANDI ${pos.instrument} ${closeReason} P&L: $${pnlUsd}`);
      closed.push({ ...pos, exitPrice: currentPrice, pnlUsd, closeReason });
    }
  }

  return closed;
}

async function getAccountSummary() {
  const account = await getAccount();
  if (!account) return null;
  const winRate = account.total_trades > 0
    ? Math.round((account.winning_trades / account.total_trades) * 100)
    : 0;
  return { ...account, winRate };
}

async function listOpenPositions() {
  const { data, error } = await sb
    .from('paper_positions')
    .select('instrument,direction,position_usd,opened_at')
    .eq('status', 'open');

  if (error) {
    logger.warn('paperPortfolio: açık pozisyonlar okunamadı', { error: error.message });
    return [];
  }

  return (data || []).map(p => ({
    instrument: p.instrument,
    direction: p.direction,
    positionUsd: Number(p.position_usd || 0),
    openedAt: p.opened_at,
  }));
}

module.exports = {
  openPosition,
  checkAndClosePositions,
  getAccountSummary,
  listOpenPositions,
  getClosedPerformanceByInstrument,
};

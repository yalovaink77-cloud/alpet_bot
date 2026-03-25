/**
 * Paper Portfolio Manager
 * 40$ sanal bakiye ile simülasyon trade yönetimi.
 * Pozisyon açar, kapatır, P&L hesaplar, Supabase'e kaydeder.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { getPrice } = require('./priceOracle');
const logger = require('./logger');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Her işlemde bakiyenin max %10'unu riske at
const POSITION_SIZE_PCT = 0.10;
// Stop-loss: giriş fiyatından %2 ters giderse kapat
const STOP_LOSS_PCT = 0.02;
// Take-profit: giriş fiyatından %3 kâra gelince kapat
const TAKE_PROFIT_PCT = 0.03;

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

  const entryPrice = await getPrice(signal.instrument);
  if (!entryPrice) {
    logger.warn(`paperPortfolio: ${signal.instrument} fiyat alınamadı, pozisyon açılamıyor`);
    return null;
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

  logger.info(`paperPortfolio: AÇILDI ${signal.instrument} ${signal.direction} @ ${entryPrice} ($${positionUsd})`);
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

    let closeReason = null;
    if (pnlPct <= -STOP_LOSS_PCT) closeReason = 'STOP_LOSS';
    else if (pnlPct >= TAKE_PROFIT_PCT) closeReason = 'TAKE_PROFIT';

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

module.exports = { openPosition, checkAndClosePositions, getAccountSummary };

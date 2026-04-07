/**
 * src/risk/volatilityPositionSizer.js
 *
 * Volatility-targeting position sizing.
 *
 * Formula:
 *   daily_vol    = EWMA(daily_returns, decay=0.94) over last LOOKBACK days
 *   annual_vol   = daily_vol * sqrt(252)
 *   leverage     = clamp(target_vol / annual_vol, 0, MAX_LEVERAGE)
 *   position_size = leverage * capital
 *
 * No-trade band: if |current_leverage - prev_leverage| < NO_TRADE_BAND
 *   → return previous size unchanged (avoids churning on small vol changes).
 *
 * Config (overridable via env):
 *   TARGET_VOL      = 0.15   (annual 15%)
 *   MAX_LEVERAGE    = 2.0
 *   MIN_ALLOCATION  = 0.20   (always deploy at least 20% of capital)
 *   NO_TRADE_BAND   = 0.10   (don't resize if leverage shift < 10%)
 *   EWMA_DECAY      = 0.94
 *   LOOKBACK_DAYS   = 20
 */

const supabaseClient = require('../storage/supabaseClient');
const logger         = require('../utils/logger');
const { getRecentCloses } = require('../utils/priceOracle');

// ── Config ────────────────────────────────────────────────────────────────────
const TARGET_VOL     = Number(process.env.TARGET_VOL)     || 0.15;
const MAX_LEVERAGE   = Number(process.env.MAX_LEVERAGE)   || 2.0;
const MIN_ALLOCATION = Number(process.env.MIN_ALLOCATION) || 0.20;
const NO_TRADE_BAND  = Number(process.env.NO_TRADE_BAND)  || 0.10;
const EWMA_DECAY     = Number(process.env.EWMA_DECAY)     || 0.94;
const LOOKBACK_DAYS  = Number(process.env.LOOKBACK_DAYS)  || 20;

// ── EWMA Volatility ───────────────────────────────────────────────────────────

/**
 * Compute EWMA realized volatility from an array of daily log-returns.
 * Returns the daily volatility (not annualized).
 *
 * @param {number[]} returns  Array of daily log-returns, oldest first
 * @param {number}   decay    EWMA decay factor (0 < decay < 1)
 * @returns {number} EWMA daily volatility
 */
function ewmaVolatility(returns, decay = EWMA_DECAY) {
  if (returns.length === 0) return 0;

  // Seed variance with the first squared return
  let variance = returns[0] ** 2;

  for (let i = 1; i < returns.length; i++) {
    variance = decay * variance + (1 - decay) * returns[i] ** 2;
  }

  return Math.sqrt(variance);
}

/**
 * Convert an array of close prices to daily log-returns.
 * @param {number[]} prices  Close prices, oldest first (length >= 2)
 * @returns {number[]} Log-returns
 */
function toLogReturns(prices) {
  const rets = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      rets.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return rets;
}

// ── Main sizing function ──────────────────────────────────────────────────────

/**
 * Compute volatility-adjusted position size for a given instrument.
 *
 * @param {string} instrument   e.g. 'AKBNK', 'USDTRY'
 * @param {number} capital      Available capital in USD
 * @param {number} [prevLeverage]  Previous leverage (for no-trade band check)
 * @returns {Promise<{
 *   positionSize: number,
 *   leverage: number,
 *   dailyVol: number,
 *   annualVol: number,
 *   noTradeBandHit: boolean,
 *   insufficientData: boolean,
 * }>}
 */
async function volatilityPositionSizer(instrument, capital, prevLeverage = null) {
  // ── 1. Fetch price history ──────────────────────────────────────────────────
  let prices = await supabaseClient.getPriceHistory(instrument, LOOKBACK_DAYS + 1);

  // Supabase'te fiyat geçmişi yoksa Yahoo (priceOracle) üzerinden fallback dene.
  if (!prices || prices.length < 5) {
    const oracleCloses = await getRecentCloses(instrument, LOOKBACK_DAYS + 1);
    if (oracleCloses && oracleCloses.length >= 5) {
      prices = oracleCloses.map(Number).filter(n => Number.isFinite(n));
    }
  }

  if (prices.length < 5) {
    // Not enough history — use minimum allocation as safe fallback
    logger.warn(`volatilityPositionSizer: insufficient price data for ${instrument} (${prices.length} rows), using min allocation`);
    const positionSize = capital * MIN_ALLOCATION;
    await logVolatility(instrument, 0, 0, 1, capital, positionSize, false, { insufficientData: true });
    return {
      positionSize,
      leverage: MIN_ALLOCATION,
      dailyVol: 0,
      annualVol: 0,
      noTradeBandHit: false,
      insufficientData: true,
    };
  }

  // ── 2. Compute EWMA volatility ──────────────────────────────────────────────
  const returns   = toLogReturns(prices);
  const dailyVol  = ewmaVolatility(returns);
  const annualVol = dailyVol * Math.sqrt(252);

  // ── 3. Compute leverage ─────────────────────────────────────────────────────
  let leverage;
  if (annualVol <= 0) {
    leverage = MAX_LEVERAGE;
  } else {
    leverage = TARGET_VOL / annualVol;
  }

  // Apply caps
  leverage = Math.min(leverage, MAX_LEVERAGE);
  leverage = Math.max(leverage, MIN_ALLOCATION);

  // ── 4. No-trade band check ──────────────────────────────────────────────────
  let noTradeBandHit = false;
  if (prevLeverage !== null && Math.abs(leverage - prevLeverage) < NO_TRADE_BAND) {
    leverage        = prevLeverage; // keep previous size
    noTradeBandHit  = true;
  }

  // ── 5. Compute final position size ─────────────────────────────────────────
  const positionSize = leverage * capital;

  // ── 6. Log to Supabase ─────────────────────────────────────────────────────
  await logVolatility(instrument, dailyVol, annualVol, leverage, capital, positionSize, noTradeBandHit);

  logger.info(`volatilityPositionSizer: ${instrument} annualVol=${(annualVol * 100).toFixed(1)}% leverage=${leverage.toFixed(2)}x size=$${positionSize.toFixed(2)}`);

  return {
    positionSize: Number(positionSize.toFixed(4)),
    leverage:     Number(leverage.toFixed(4)),
    dailyVol:     Number(dailyVol.toFixed(6)),
    annualVol:    Number(annualVol.toFixed(6)),
    noTradeBandHit,
    insufficientData: false,
  };
}

// ── Logging helper ────────────────────────────────────────────────────────────

async function logVolatility(instrument, dailyVol, annualVol, leverage, capital, positionSize, noTradeBandHit, extra = {}) {
  try {
    await supabaseClient.saveVolatilityLog({
      instrument,
      daily_vol:         Number(dailyVol.toFixed(6)),
      annual_vol:        Number(annualVol.toFixed(6)),
      target_vol:        TARGET_VOL,
      leverage:          Number(leverage.toFixed(4)),
      capital:           Number(capital.toFixed(4)),
      position_size:     Number(positionSize.toFixed(4)),
      no_trade_band_hit: noTradeBandHit,
      metadata:          extra,
    });
  } catch (err) {
    // Non-fatal — logging failure should not block trade execution
    logger.warn(`volatilityPositionSizer: failed to log vol for ${instrument}: ${err.message}`);
  }
}

module.exports = {
  volatilityPositionSizer,
  ewmaVolatility,
  toLogReturns,
  TARGET_VOL,
  MAX_LEVERAGE,
  MIN_ALLOCATION,
  NO_TRADE_BAND,
};

-- Migration 003: Volatility Targeting — price_history + volatility_log tables
-- Run in Supabase SQL Editor after 001_init_alpet.sql and 002_paper_trading.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Daily close prices per instrument — populated by outcome_labeler or a
-- dedicated price collector. One row per instrument per trading day.
CREATE TABLE IF NOT EXISTS price_history (
  id           BIGSERIAL PRIMARY KEY,
  instrument   TEXT        NOT NULL,
  price_date   DATE        NOT NULL,
  close_price  NUMERIC(18,6) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (instrument, price_date)
);

CREATE INDEX IF NOT EXISTS idx_price_history_instrument_date
  ON price_history (instrument, price_date DESC);

-- ── Volatility log ────────────────────────────────────────────────────────────
-- One row written per signal per instrument by volatilityPositionSizer.js.
-- Allows back-tracking and auditing position sizing decisions.
CREATE TABLE IF NOT EXISTS volatility_log (
  id            BIGSERIAL PRIMARY KEY,
  instrument    TEXT          NOT NULL,
  logged_at     TIMESTAMPTZ   DEFAULT NOW(),
  daily_vol     NUMERIC(10,6) NOT NULL,   -- EWMA realized daily volatility
  annual_vol    NUMERIC(10,6) NOT NULL,   -- daily_vol * sqrt(252)
  target_vol    NUMERIC(10,6) NOT NULL,   -- configured target (0.15)
  leverage      NUMERIC(8,4)  NOT NULL,   -- target_vol / current_vol, capped
  capital       NUMERIC(18,6) NOT NULL,   -- capital used for sizing
  position_size NUMERIC(18,6) NOT NULL,   -- leverage * capital (USD notional)
  no_trade_band_hit BOOLEAN   DEFAULT FALSE,
  metadata      JSONB         DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_volatility_log_instrument
  ON volatility_log (instrument, logged_at DESC);

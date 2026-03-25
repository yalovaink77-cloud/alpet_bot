-- Paper Trading tabloları
-- Supabase SQL Editor'da çalıştır

CREATE TABLE IF NOT EXISTS paper_account (
  id INTEGER DEFAULT 1 PRIMARY KEY,
  balance_usd DECIMAL(10,2) DEFAULT 40.00,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO paper_account (id, balance_usd, total_trades, winning_trades)
VALUES (1, 40.00, 0, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS paper_positions (
  id BIGSERIAL PRIMARY KEY,
  instrument TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_price DECIMAL(18,6),
  position_usd DECIMAL(10,2),
  status TEXT DEFAULT 'open',
  exit_price DECIMAL(18,6),
  pnl_usd DECIMAL(10,2),
  signal_score INTEGER,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  close_reason TEXT
);

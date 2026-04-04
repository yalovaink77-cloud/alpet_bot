-- Migration 004: Breakeven stop tracking on paper_positions
-- Run in Supabase SQL Editor after 003_volatility_targeting.sql

ALTER TABLE paper_positions
  ADD COLUMN IF NOT EXISTS breakeven_triggered BOOLEAN DEFAULT FALSE;

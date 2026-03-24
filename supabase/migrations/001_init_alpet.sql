create extension if not exists pgcrypto;

create table if not exists raw_news (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  source_type text not null,
  source_name text not null,
  external_id text,
  url text,
  title text,
  raw_content text,
  language text,
  published_at timestamptz,
  detected_at timestamptz default now(),
  content_hash text unique,
  is_duplicate boolean default false,
  metadata jsonb default '{}'::jsonb
);

create table if not exists normalized_events (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  raw_news_id uuid references raw_news(id) on delete cascade,
  event_key text unique not null,
  event_class text not null,
  event_type text not null,
  source_type text not null,
  source_name text not null,
  title text,
  summary text,
  region text,
  country_tags jsonb default '[]'::jsonb,
  actor_tags jsonb default '[]'::jsonb,
  asset_tags jsonb default '[]'::jsonb,
  channels jsonb default '[]'::jsonb,
  severity text,
  novelty text,
  credibility text,
  directness_to_turkey text,
  candidate_instruments jsonb default '[]'::jsonb,
  historical_match_required boolean default true,
  execution_bias text,
  published_at timestamptz,
  detected_at timestamptz default now(),
  cluster_key text,
  metadata jsonb default '{}'::jsonb
);

create table if not exists event_signals (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  event_id uuid references normalized_events(id) on delete cascade,
  instrument text not null,
  decision text not null,
  direction text,
  source_score integer,
  credibility_score integer,
  novelty_score integer,
  severity_score integer,
  turkey_relevance_score integer,
  historical_similarity_score integer,
  historical_consistency_score integer,
  instrument_alignment_score integer,
  timing_score integer,
  penalty_score integer default 0,
  final_score integer not null,
  trade_confidence numeric(6,4),
  late_move_detected boolean default false,
  already_priced_penalty boolean default false,
  single_source_penalty boolean default false,
  thematic_only_penalty boolean default false,
  low_history_penalty boolean default false,
  contradictory_history_penalty boolean default false,
  execution_risk_penalty boolean default false,
  portfolio_crowding_penalty boolean default false,
  explanation jsonb default '{}'::jsonb,
  unique (event_id, instrument)
);

create table if not exists historical_event_matches (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  event_id uuid references normalized_events(id) on delete cascade,
  matched_event_id uuid references normalized_events(id) on delete set null,
  matched_event_key text,
  similarity_score numeric(6,4) not null,
  matched_on jsonb default '{}'::jsonb,
  reaction_stats jsonb default '{}'::jsonb
);

create table if not exists trades (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  signal_id uuid references event_signals(id) on delete set null,
  event_id uuid references normalized_events(id) on delete set null,
  broker_name text,
  broker_order_id text,
  instrument text not null,
  direction text not null,
  status text not null,
  quantity numeric(18,6),
  lot_size numeric(18,6),
  open_price numeric(18,6),
  close_price numeric(18,6),
  sl numeric(18,6),
  tp numeric(18,6),
  opened_at timestamptz,
  closed_at timestamptz,
  pnl numeric(18,6),
  fees numeric(18,6),
  slippage numeric(18,6),
  execution_notes jsonb default '{}'::jsonb,
  unique (broker_name, broker_order_id)
);

create table if not exists event_outcomes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  event_id uuid references normalized_events(id) on delete cascade,
  signal_id uuid references event_signals(id) on delete set null,
  instrument text,
  outcome_horizon text,
  direction text,
  realized_move numeric(18,6),
  benchmark_move numeric(18,6),
  pnl numeric(18,6),
  metadata jsonb default '{}'::jsonb
);

create table if not exists account_state_snapshots (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  balance numeric(18,6),
  equity numeric(18,6),
  free_margin numeric(18,6),
  used_margin numeric(18,6),
  open_positions_count integer default 0,
  daily_loss_pct numeric(8,4) default 0,
  drawdown_pct numeric(8,4) default 0,
  positions jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb
);

create index if not exists idx_raw_news_published_at on raw_news(published_at desc);
create index if not exists idx_normalized_events_event_type on normalized_events(event_type);
create index if not exists idx_normalized_events_published_at on normalized_events(published_at desc);
create index if not exists idx_historical_event_matches_event_id on historical_event_matches(event_id);
create index if not exists idx_event_signals_decision on event_signals(decision);
create index if not exists idx_trades_status on trades(status);
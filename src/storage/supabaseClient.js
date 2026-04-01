const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

class SupabaseClient {
  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    this.enabled = Boolean(url && key);
    this.client = this.enabled ? createClient(url, key) : null;
    this.memory = {
      raw_news: [],
      normalized_events: [],
      historical_event_matches: [],
      event_signals: [],
      trades: [],
      event_outcomes: [],
      account_state_snapshots: []
    };

    if (!this.enabled) {
      logger.warn('Supabase credentials missing, using in-memory storage');
    }
  }

  async insert(table, payload) {
    if (!this.enabled) {
      if (this.memory[table]) {
        const row = {
          id: payload.id || randomUUID(),
          created_at: payload.created_at || new Date().toISOString(),
          ...payload
        };
        this.memory[table].push(row);
        return row;
      }

      return payload;
    }

    const { data, error } = await this.client.from(table).insert(payload).select().single();
    if (error) {
      // Duplicate key — skip silently
      if (error.code === '23505') return null;
      throw error;
    }

    return data;
  }

  async saveRawNews(record) {
    return this.insert('raw_news', {
      source_type: record.sourceType,
      source_name: record.sourceName,
      external_id: record.externalId || null,
      url: record.url || null,
      title: record.title,
      raw_content: record.rawContent,
      language: record.language || 'tr',
      published_at: record.publishedAt,
      detected_at: record.detectedAt,
      content_hash: record.contentHash || null,
      is_duplicate: Boolean(record.isDuplicate),
      metadata: record.metadata || {}
    });
  }

  async saveNormalizedEvent(record) {
    return this.insert('normalized_events', {
      raw_news_id: record.rawNewsId || null,
      event_key: record.eventKey,
      event_class: record.eventClass,
      event_type: record.eventType,
      source_type: record.sourceType,
      source_name: record.sourceName,
      title: record.title,
      summary: record.summary,
      region: record.region,
      country_tags: record.countryTags,
      actor_tags: record.actorTags,
      asset_tags: record.assetTags,
      channels: record.channels,
      severity: record.severity,
      novelty: record.novelty,
      credibility: record.credibility,
      directness_to_turkey: record.directnessToTurkey,
      candidate_instruments: record.candidateInstruments,
      historical_match_required: record.historicalMatchRequired,
      execution_bias: record.executionBias,
      published_at: record.publishedAt,
      detected_at: record.detectedAt,
      cluster_key: record.eventKey,
      metadata: record.metadata || {}
    });
  }

  async saveHistoricalMatch(record) {
    return this.insert('historical_event_matches', {
      event_id: record.eventId,
      matched_event_id: record.matchedEventId || null,
      matched_event_key: record.matchedEventKey || null,
      similarity_score: record.similarityScore,
      matched_on: record.matchedOn || {},
      reaction_stats: record.reactionStats || {}
    });
  }

  async saveSignal(record) {
    return this.insert('event_signals', {
      event_id: record.eventId || null,
      instrument: record.instrument,
      decision: record.decision,
      direction: record.direction,
      source_score: record.sourceScore,
      credibility_score: record.credibilityScore,
      novelty_score: record.noveltyScore,
      severity_score: record.severityScore,
      turkey_relevance_score: record.turkeyRelevanceScore,
      historical_similarity_score: record.historicalSimilarityScore,
      historical_consistency_score: record.historicalConsistencyScore,
      instrument_alignment_score: record.instrumentAlignmentScore,
      timing_score: record.timingScore,
      penalty_score: record.penaltyScore,
      final_score: record.finalScore,
      trade_confidence: record.tradeConfidence,
      late_move_detected: Boolean(record.lateMoveDetected),
      already_priced_penalty: Boolean(record.alreadyPricedPenalty),
      single_source_penalty: Boolean(record.singleSourcePenalty),
      thematic_only_penalty: Boolean(record.thematicOnlyPenalty),
      low_history_penalty: Boolean(record.lowHistoryPenalty),
      contradictory_history_penalty: Boolean(record.contradictoryHistoryPenalty),
      execution_risk_penalty: Boolean(record.executionRiskPenalty),
      portfolio_crowding_penalty: Boolean(record.portfolioCrowdingPenalty),
      explanation: record.explanation || {}
    });
  }

  async saveTrade(record) {
    return this.insert('trades', {
      signal_id: record.signalId || null,
      event_id: record.eventId || null,
      instrument: record.instrument,
      direction: record.direction,
      status: record.status,
      broker_name: record.brokerName,
      broker_order_id: record.brokerOrderId,
      quantity: record.quantity || null,
      lot_size: record.lotSize || null,
      open_price: record.openPrice || null,
      close_price: record.closePrice || null,
      sl: record.sl || null,
      tp: record.tp || null,
      opened_at: record.openedAt || new Date().toISOString(),
      closed_at: record.closedAt || null,
      pnl: record.pnl || null,
      fees: record.fees || null,
      slippage: record.slippage || null,
      execution_notes: record.executionNotes || {}
    });
  }

  async saveOutcome(record) {
    return this.insert('event_outcomes', record);
  }

  /**
   * Returns event_signals created between (now - maxAgeMinutes) and (now - minAgeMinutes)
   * that do NOT yet have a corresponding outcome for the given horizon.
   * Used by the outcome labeler to know which signals still need resolution.
   */
  async listSignalsForLabeling({ minAgeMinutes, maxAgeMinutes, horizon }) {
    if (!this.enabled) return [];

    const now = new Date();
    const from = new Date(now - maxAgeMinutes * 60 * 1000).toISOString();
    const to   = new Date(now - minAgeMinutes * 60 * 1000).toISOString();

    // Signals created in the target window
    const { data: signals, error: sigErr } = await this.client
      .from('event_signals')
      .select('id, event_id, instrument, direction, created_at')
      .gte('created_at', from)
      .lte('created_at', to);

    if (sigErr) throw sigErr;
    if (!signals || signals.length === 0) return [];

    // Exclude signals that already have an outcome for this horizon
    const { data: done, error: doneErr } = await this.client
      .from('event_outcomes')
      .select('signal_id')
      .in('signal_id', signals.map(s => s.id))
      .eq('outcome_horizon', horizon);

    if (doneErr) throw doneErr;

    const doneIds = new Set((done || []).map(r => r.signal_id));
    return signals.filter(s => !doneIds.has(s.id));
  }

  /**
   * Returns aggregated outcome stats (hit-rate, avg realized_move, consistency)
   * for a given event_type + instrument combination.
   * Used by historicalEventMatcher to build reaction_stats.
   */
  async listOutcomeStats({ eventType, instrument, horizon = '1h', minSamples = 3 }) {
    if (!this.enabled) return null;

    // Join via normalized_events to filter by event_type
    const { data, error } = await this.client
      .from('event_outcomes')
      .select(`
        direction,
        realized_move,
        signal_id,
        normalized_events!event_outcomes_event_id_fkey (event_type)
      `)
      .eq('instrument', instrument)
      .eq('outcome_horizon', horizon)
      .not('realized_move', 'is', null);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    // Filter by event_type
    const rows = data.filter(r => r.normalized_events?.event_type === eventType);
    if (rows.length < minSamples) return null;

    const correct = rows.filter(r =>
      (r.direction === 'long'  && r.realized_move > 0) ||
      (r.direction === 'short' && r.realized_move < 0)
    ).length;

    const hitRate = correct / rows.length;
    const avgMove = rows.reduce((s, r) => s + Number(r.realized_move), 0) / rows.length;
    // consistencyScore: 0–1, matches what confidenceCalibrator.scoreEvent() expects
    const consistencyScore = hitRate;

    return {
      samples: rows.length,
      hitRate: Number(hitRate.toFixed(4)),
      avgMove: Number(avgMove.toFixed(6)),
      consistencyScore: Number(consistencyScore.toFixed(4))
    };
  }

  async saveAccountSnapshot(record) {
    return this.insert('account_state_snapshots', {
      balance: record.balance || null,
      equity: record.equity || null,
      free_margin: record.freeMargin || null,
      used_margin: record.usedMargin || null,
      open_positions_count: record.openPositionsCount || 0,
      daily_loss_pct: record.dailyLossPct || 0,
      drawdown_pct: record.drawdownPct || 0,
      positions: record.positions || [],
      metadata: record.metadata || {}
    });
  }

  async listNormalizedEvents() {
    if (!this.enabled) {
      return this.memory.normalized_events;
    }

    const { data, error } = await this.client
      .from('normalized_events')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(250);

    if (error) {
      throw error;
    }

    return data;
  }

  async getPriceHistory(instrument, days = 21) {
    if (!this.enabled) return [];
    const { data, error } = await this.client
      .from('price_history')
      .select('close_price')
      .eq('instrument', instrument)
      .order('price_date', { ascending: true })
      .limit(days);
    if (error) throw error;
    return (data || []).map(r => Number(r.close_price));
  }

  async saveVolatilityLog(record) {
    return this.insert('volatility_log', {
      instrument:        record.instrument,
      logged_at:         new Date().toISOString(),
      daily_vol:         record.daily_vol,
      annual_vol:        record.annual_vol,
      target_vol:        record.target_vol,
      leverage:          record.leverage,
      capital:           record.capital,
      position_size:     record.position_size,
      no_trade_band_hit: record.no_trade_band_hit || false,
      metadata:          record.metadata || {},
    });
  }
}

module.exports = new SupabaseClient();
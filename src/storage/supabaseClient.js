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
}

module.exports = new SupabaseClient();
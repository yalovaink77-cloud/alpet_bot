const supabaseClient = require('./supabaseClient');

class HistoricalEventStore {
  async getRecentEvents(filters = {}, limit = 250) {
    const records = await supabaseClient.listNormalizedEvents();
    return records
      .filter((record) => {
        if (filters.excludeEventKey && (record.event_key === filters.excludeEventKey || record.eventKey === filters.excludeEventKey)) {
          return false;
        }

        if (filters.eventClass && (record.event_class || record.eventClass) !== filters.eventClass) {
          return false;
        }

        if (filters.region && record.region !== filters.region) {
          return false;
        }

        return true;
      })
      .slice(0, limit);
  }

  /**
   * Returns aggregated outcome stats for a given eventType + instrument combo.
   * Returns null when there is insufficient data (< minSamples).
   *
   * Shape: { samples, hitRate, avgMove, consistencyScore }
   * consistencyScore is in [0, 1] — directly usable by confidenceCalibrator.scoreEvent().
   */
  async getOutcomeStats({ eventType, instrument, horizon = '1h', minSamples = 3 }) {
    return supabaseClient.listOutcomeStats({ eventType, instrument, horizon, minSamples });
  }
}

module.exports = new HistoricalEventStore();
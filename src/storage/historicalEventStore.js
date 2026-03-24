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
}

module.exports = new HistoricalEventStore();
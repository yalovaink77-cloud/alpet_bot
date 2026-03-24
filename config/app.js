function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

const APP_CONFIG = {
  env: process.env.NODE_ENV || 'development',
  timezone: process.env.APP_TIMEZONE || 'Europe/Istanbul',
  cronSchedule: process.env.CRON_SCHEDULE || '*/5 * * * *',
  thresholds: {
    execute: numberFromEnv('SIGNAL_THRESHOLD', 80),
    watch: numberFromEnv('WATCH_THRESHOLD', 40)
  },
  risk: {
    maxDailyLossPct: numberFromEnv('MAX_DAILY_LOSS_PCT', 3),
    maxDrawdownPct: numberFromEnv('MAX_DRAWDOWN_PCT', 15),
    maxOpenPositions: numberFromEnv('MAX_OPEN_POSITIONS', 4)
  },
  execution: {
    liveTradingEnabled: process.env.ENABLE_LIVE_TRADING === 'true',
    paperTradingEnabled: process.env.ENABLE_PAPER_TRADING !== 'false'
  }
};

module.exports = {
  APP_CONFIG
};
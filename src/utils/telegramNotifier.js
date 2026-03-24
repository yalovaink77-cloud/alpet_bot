const https = require('https');
const logger = require('./logger');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Aynı instrument+direction için 1 cycle (5 dk) cooldown — cycle içi spam önleme
const COOLDOWN_MS = 5 * 60 * 1000;
const lastSent = {}; // key: "INSTRUMENT|DIRECTION" → timestamp

function send(text) {
  if (!TOKEN || !CHAT_ID) return;

  const body = JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, (res) => {
    if (res.statusCode !== 200) logger.warn('Telegram send failed', { status: res.statusCode });
  });
  req.on('error', (e) => logger.warn('Telegram error', { error: e.message }));
  req.write(body);
  req.end();
}

function notifySignal(signal, event) {
  const key = `${signal.instrument}|${signal.direction}`;
  const now = Date.now();

  if (lastSent[key] && now - lastSent[key] < COOLDOWN_MS) {
    const kalan = Math.round((COOLDOWN_MS - (now - lastSent[key])) / 60000);
    logger.info(`Telegram cooldown: ${key} (${kalan} dk sonra tekrar gönderilebilir)`);
    return;
  }

  lastSent[key] = now;

  const icon = signal.direction === 'LONG' ? '🟢' : signal.direction === 'SHORT' ? '🔴' : '🟡';
  const text = `${icon} <b>ALPET SİNYAL</b>

📌 <b>${signal.instrument}</b> — ${signal.direction || '—'}
⚡ Karar: <b>${signal.decision}</b>
📊 Skor: <b>${signal.finalScore}/100</b>
📰 Kaynak: ${event.sourceName}
🏷 Olay: ${event.eventType}
🕐 ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`;

  send(text);
}

module.exports = { send, notifySignal };

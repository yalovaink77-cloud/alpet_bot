/**
 * Price Oracle
 * Enstrümanlar için canlı fiyat çeker.
 * Kaynak: Yahoo Finance (ücretsiz, API key gerektirmez)
 */

const https = require('https');
const logger = require('../utils/logger');

// instrument → Yahoo Finance sembolü
const YAHOO_SYMBOLS = {
  'USDTRY':  'USDTRY=X',
  'EURTRY':  'EURTRY=X',
  'XAUUSD':  'GC=F',
  'BRENT':   'BZ=F',
  'VIOP30':  'XU030.IS',
  'GARAN':   'GARAN.IS',
  'AKBNK':   'AKBNK.IS',
  'THYAO':   'THYAO.IS',
  'TUPRS':   'TUPRS.IS',
  'PGSUS':   'PGSUS.IS',
  'KOZAL':   'KOZAL.IS',
};

function fetchPriceData(symbol, range, interval) {
  return new Promise((resolve) => {
    const yahooSym = YAHOO_SYMBOLS[symbol] || symbol;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=${interval}&range=${range}`;

    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

/**
 * Son N günlük kapanış fiyatlarını döner (en eskiden en yeniye).
 * Trend tespiti için kullanılır.
 */
async function getRecentCloses(instrument, days = 5) {
  try {
    const json = await fetchPriceData(instrument, `${days}d`, '1d');
    const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!closes) return null;
    return closes.filter(c => c != null);
  } catch {
    return null;
  }
}

function fetchPrice(symbol) {
  return new Promise((resolve) => {
    const yahooSym = YAHOO_SYMBOLS[symbol] || symbol;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1m&range=1d`;

    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const meta = json?.chart?.result?.[0]?.meta;
          const price = meta?.regularMarketPrice || meta?.previousClose || null;
          resolve(price);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

async function getPrice(instrument) {
  try {
    const price = await fetchPrice(instrument);
    if (price) logger.info(`PriceOracle: ${instrument} = ${price}`);
    else logger.warn(`PriceOracle: ${instrument} fiyat alınamadı`);
    return price;
  } catch {
    return null;
  }
}

module.exports = { getPrice, getRecentCloses };

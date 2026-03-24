const INSTRUMENTS = {
  FX: ['USDTRY', 'XAUUSD', 'BRENT'],
  VIOP: ['VIOP30'],
  BIST: ['THYAO', 'PGSUS', 'TUPRS', 'KOZAL', 'GARAN', 'AKBNK']
};

const INSTRUMENT_METADATA = {
  USDTRY: { market: 'FX', effectType: 'direct' },
  XAUUSD: { market: 'FX', effectType: 'direct' },
  BRENT: { market: 'FX', effectType: 'direct' },
  VIOP30: { market: 'VIOP', effectType: 'direct' },
  THYAO: { market: 'BIST', effectType: 'direct' },
  PGSUS: { market: 'BIST', effectType: 'direct' },
  TUPRS: { market: 'BIST', effectType: 'direct' },
  KOZAL: { market: 'BIST', effectType: 'direct' },
  GARAN: { market: 'BIST', effectType: 'indirect' },
  AKBNK: { market: 'BIST', effectType: 'indirect' }
};

module.exports = {
  INSTRUMENTS,
  INSTRUMENT_METADATA
};
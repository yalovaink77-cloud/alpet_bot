// eventExtractor.js
// Extraction servisinden olay ve aktör bilgisini çeker
const axios = require('axios');
const logger = require('./logger');

const DEFAULT_EXTRACTOR_URL = 'http://localhost:5000/extract';
const EXTRACTOR_URL = process.env.EXTRACTOR_URL || DEFAULT_EXTRACTOR_URL;
const EXTRACTION_ENABLED = process.env.ENABLE_EXTRACTION_SERVICE === 'true';

// Servis kapalıyken log spam'ini engellemek için cooldown.
const ERROR_COOLDOWN_MS = 60 * 1000;
let lastErrorAt = 0;

async function extractEventEntities(newsText) {
  if (!EXTRACTION_ENABLED) return null;

  try {
    const response = await axios.post(EXTRACTOR_URL, { text: newsText }, { timeout: 6000 });
    return response.data; // { eventType, actors, stage, context, magnitude }
  } catch (err) {
    const now = Date.now();
    if (now - lastErrorAt > ERROR_COOLDOWN_MS) {
      lastErrorAt = now;
      logger.warn('Extraction service unavailable, skipping entity extraction', {
        error: err.message,
        url: EXTRACTOR_URL,
      });
    }
    return null;
  }
}

module.exports = { extractEventEntities };
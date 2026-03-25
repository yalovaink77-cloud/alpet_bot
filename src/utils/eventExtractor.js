// eventExtractor.js
// Extraction servisinden olay ve aktör bilgisini çeker
const axios = require('axios');

async function extractEventEntities(newsText) {
  try {
    const response = await axios.post('http://localhost:5000/extract', { text: newsText });
    return response.data; // { eventType, actors, stage, context, magnitude }
  } catch (err) {
    console.error('Extraction service error:', err.message);
    return null;
  }
}

module.exports = { extractEventEntities };
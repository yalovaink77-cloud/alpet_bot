const test = require('node:test');
const assert = require('node:assert/strict');

const { enrichClassification } = require('../src/analyzers/eventClassifier');
const { normalize } = require('../src/analyzers/eventNormalizer');

test('geopolitical escalation maps to Turkey-relevant instruments', () => {
  const event = normalize({
    sourceType: 'rss',
    sourceName: 'Anadolu Ajansi',
    title: 'Iran ve Israel arasinda yeni saldiri dalgasi',
    summary: 'Bolgedeki saldiri petrol ve guvenli liman talebini artirdi.',
    publishedAt: '2026-03-24T00:00:00.000Z',
    credibility: 'high',
    reliabilityScore: 15,
    url: 'https://example.com/geopolitics'
  });

  assert.equal(event.eventClass, 'Geopolitics');
  assert.equal(event.eventType, 'military_escalation');
  assert.equal(event.historicalMatchRequired, true);
  assert.ok(event.candidateInstruments.includes('BRENT'));
  assert.ok(event.candidateInstruments.includes('VIOP30'));
  assert.ok(event.channels.includes('risk_off'));
});

test('TCMB rate headline stays macro and does not drift into AI classification', () => {
  const classification = enrichClassification({
    sourceName: 'TCMB',
    title: 'Merkez Bankasi faiz kararini acikladi',
    summary: 'TCMB politika faizini sabit tuttu.',
    credibility: 'high'
  });

  assert.equal(classification.eventClass, 'Central Banks & Macro');
  assert.equal(classification.eventType, 'hold_surprise_hawkish');
  assert.notEqual(classification.eventType, 'ai_breakthrough');
});

test('company disclosure keeps company-specific mapping for THYAO buyback', () => {
  const event = normalize({
    sourceType: 'disclosure',
    sourceName: 'KAP',
    title: 'THYAO geri alim programi acikladi',
    summary: 'Sirket yeni geri alim programini duyurdu.',
    publishedAt: '2026-03-24T00:00:00.000Z',
    credibility: 'high',
    reliabilityScore: 15,
    url: 'https://example.com/kap'
  });

  assert.equal(event.eventClass, 'Company / Disclosure Events');
  assert.equal(event.eventType, 'buyback_announcement');
  assert.ok(event.channels.includes('company_specific'));
  assert.ok(event.candidateInstruments.includes('THYAO'));
});

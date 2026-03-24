const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { parseDisclosures } = require('../src/collectors/companyDisclosureCollector');
const { parseAnnouncements } = require('../src/collectors/tcmbCollector');

function readFixture(fileName) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', fileName), 'utf8');
}

test('KAP parser keeps only disclosure-like links and deduplicates them', () => {
  const html = readFixture('kap-homepage.html');
  const publishedAt = '2026-03-24T00:00:00.000Z';
  const items = parseDisclosures(html, publishedAt);

  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.title), [
    'THYAO geri alim programi acikladi',
    'TUPRS kar payi dagitim karari'
  ]);
  assert.equal(items[0].url, 'https://www.kap.org.tr/tr/Bildirim/123456');
  assert.equal(items[1].url, 'https://www.kap.org.tr/tr/Bildirim/987654');
  assert.equal(items[0].publishedAt, publishedAt);
});

test('TCMB parser keeps macro-relevant announcements and normalizes relative URLs', () => {
  const html = readFixture('tcmb-homepage.html');
  const publishedAt = '2026-03-24T00:00:00.000Z';
  const items = parseAnnouncements(html, publishedAt);

  assert.equal(items.length, 3);
  assert.deepEqual(items.map((item) => item.title), [
    'Merkez Bankasi faiz kararini acikladi',
    'Enflasyon raporu bilgilendirmesi',
    'TCMB press release on monetary policy'
  ]);
  assert.equal(items[0].url, 'https://www.tcmb.gov.tr/wps/wcm/connect/tr/tcmb+tr/main+menu/duyurular/faiz-karari');
  assert.equal(items[2].url, 'https://www.tcmb.gov.tr/wps/wcm/connect/en/tcmb+en/main+menu/announcements/press+releases');
  assert.equal(items[0].publishedAt, publishedAt);
});
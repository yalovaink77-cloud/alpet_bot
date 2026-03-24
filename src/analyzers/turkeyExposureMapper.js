function mapChannelsToInstruments(event) {
  const channels = event.channels || [];
  const instruments = new Set();

  if (channels.includes('oil_up')) {
    instruments.add('BRENT');
    instruments.add('TUPRS');
    instruments.add('THYAO');
    instruments.add('PGSUS');
  }

  if (channels.includes('gold_up')) {
    instruments.add('XAUUSD');
    instruments.add('KOZAL');
  }

  if (channels.includes('usdtry_up') || channels.includes('usdtry_move')) {
    instruments.add('USDTRY');
    instruments.add('GARAN');
    instruments.add('AKBNK');
  }

  if (channels.includes('risk_off') || channels.includes('risk_repricing')) {
    instruments.add('VIOP30');
  }

  if (channels.includes('company_specific') && /thyao/i.test(event.title)) {
    instruments.add('THYAO');
  }

  if (channels.includes('company_specific') && /tuprs/i.test(event.title)) {
    instruments.add('TUPRS');
  }

  return [...instruments];
}

module.exports = {
  mapChannelsToInstruments
};
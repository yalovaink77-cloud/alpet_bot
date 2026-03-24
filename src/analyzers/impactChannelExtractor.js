function extractImpactChannels(event) {
  const channelSet = new Set(event.channels || []);

  if (event.eventClass === 'Geopolitics') {
    channelSet.add('risk_off');
  }

  if (event.eventClass === 'Company / Disclosure Events') {
    channelSet.add('company_specific');
  }

  return [...channelSet];
}

module.exports = {
  extractImpactChannels
};
function classifySeverity(text) {
  const lower = text.toLowerCase();
  if (/(war|attack|strike|sanction|emergency|crash)/.test(lower)) {
    return 'high';
  }

  if (/(rate|inflation|oil|gold|hack|upgrade|downgrade)/.test(lower)) {
    return 'medium';
  }

  return 'low';
}

function hasMatch(pattern, text) {
  return pattern.test(text);
}

function classifyEvent(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const geopoliticsPattern = /\b(iran|israel|usa|abd|missile|attack|ceasefire|sanction|war)\b/;
  const macroPattern = /\b(tcmb|merkez bankasi|faiz|interest rate|inflation|cpi|fed|ecb)\b/;
  const commodityPattern = /\b(oil|brent|petrol|gold|altin|natural gas|gas|lng)\b/;
  const cryptoPattern = /\b(btc|bitcoin|eth|ethereum|crypto|stablecoin|blockchain|kripto|etf)\b/;
  const kapPattern = /\b(kap|geri alim|buyback|insider|ortak satis|sozlesme|ihale)\b/;
  const technologyPattern = /\b(yapay zeka|artificial intelligence|ai|chip|chips|semiconductor|cyber|cloud|electric vehicle|ev|5g)\b/;

  if (hasMatch(geopoliticsPattern, text)) {
    return {
      eventClass: 'Geopolitics',
      eventType: 'military_escalation',
      region: 'Middle East',
      channels: ['oil_up', 'gold_up', 'risk_off', 'usdtry_up'],
      assetTags: ['oil', 'gold', 'usdtry', 'bist30'],
      actorTags: ['state_military'],
      countryTags: ['Turkey'],
      directnessToTurkey: 'indirect',
      executionBias: 'mixed'
    };
  }

  if (hasMatch(macroPattern, text)) {
    return {
      eventClass: 'Central Banks & Macro',
      eventType: /\b(rate hike|faiz art)\b/i.test(text) ? 'rate_hike' : 'hold_surprise_hawkish',
      region: 'Global Macro',
      channels: ['usdtry_move', 'risk_repricing'],
      assetTags: ['usdtry', 'banks', 'bist30'],
      actorTags: ['central_bank'],
      countryTags: ['Turkey'],
      directnessToTurkey: 'direct',
      executionBias: 'mixed'
    };
  }

  if (hasMatch(commodityPattern, text)) {
    const isGold = /\b(gold|altin)\b/.test(text);
    return {
      eventClass: 'Commodities',
      eventType: isGold ? 'gold_safe_haven_surge' : 'oil_supply_shock',
      region: 'Global Commodities',
      channels: isGold ? ['gold_up', 'risk_off'] : ['oil_up', 'inflation_risk'],
      assetTags: isGold ? ['gold', 'xauusd'] : ['oil', 'brent'],
      actorTags: ['commodity_market'],
      countryTags: ['Turkey'],
      directnessToTurkey: 'direct',
      executionBias: isGold ? 'long_bias' : 'mixed'
    };
  }

  if (hasMatch(cryptoPattern, text)) {
    return {
      eventClass: 'Crypto Assets',
      eventType: /\b(eth|ethereum)\b/.test(text) ? 'eth_breakout' : 'btc_breakout',
      region: 'Global Digital Assets',
      channels: ['risk_on', 'thematic_tech'],
      assetTags: ['btc', 'eth', 'risk_sentiment'],
      actorTags: ['crypto_market'],
      countryTags: ['Turkey'],
      directnessToTurkey: 'thematic',
      executionBias: 'watch_only'
    };
  }

  if (hasMatch(kapPattern, text)) {
    return {
      eventClass: 'Company / Disclosure Events',
      eventType: /\b(buyback|geri alim|insider buy)\b/.test(text) ? 'buyback_announcement' : 'kap_disclosure_positive',
      region: 'Turkey',
      channels: ['company_specific'],
      assetTags: ['company_specific'],
      actorTags: ['listed_company'],
      countryTags: ['Turkey'],
      directnessToTurkey: 'direct',
      executionBias: 'mixed'
    };
  }

  if (hasMatch(technologyPattern, text)) {
    return {
      eventClass: 'Technology & Innovation',
      eventType: /\b(yapay zeka|artificial intelligence|ai)\b/.test(text) ? 'ai_breakthrough' : 'semiconductor_restriction',
      region: 'Global Technology',
      channels: ['thematic_tech'],
      assetTags: ['technology'],
      actorTags: ['technology_sector'],
      countryTags: ['Turkey'],
      directnessToTurkey: 'thematic',
      executionBias: 'watch_only'
    };
  }

  return {
    eventClass: 'Financial Conditions & Flows',
    eventType: 'global_risk_off',
    region: 'Global',
    channels: ['risk_off'],
    assetTags: ['bist30'],
    actorTags: ['market'],
    countryTags: ['Turkey'],
    directnessToTurkey: 'indirect',
    executionBias: 'watch_only'
  };
}

function enrichClassification(item) {
  const classification = classifyEvent(item);
  return {
    ...classification,
    severity: classifySeverity(`${item.title} ${item.summary}`),
    novelty: 'new_information',
    credibility: item.credibility || 'medium'
  };
}

module.exports = {
  enrichClassification
};
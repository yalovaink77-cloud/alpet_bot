'use strict';

function classifySeverity(text) {
  const lower = text.toLowerCase();

  if (/(war|attack|strike|crash|collapse|emergency|iflas|kriz|crisis|devaluation|kur krizi|default|sovereign)/.test(lower)) {
    return 'extreme';
  }

  if (/(rate hike|faiz artış|enflasyon yüksel|inflation surge|recession|durgunluk|fed hike|ecb hike|tcmb|merkez bankası|rate cut|faiz indi|devalüasyon|sanctions|yaptırım|embargo)/.test(lower)) {
    return 'high';
  }

  if (/(rate|inflation|enflasyon|oil|gold|altin|petrol|hack|upgrade|downgrade|fed|ecb|gdp|büyüme|ihracat|trade deficit|cari açık|bütçe açığı|interest|faiz)/.test(lower)) {
    return 'medium';
  }

  return 'low';
}

function classifyNovelty(item) {
  const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();

  if (/(breaking|son dakika|flash|urgent|acil|ilk kez|first time|unexpected|sürpriz|surprise)/.test(text)) {
    return 'new_information';
  }

  if (/(update|güncel|revise|revizyon|revised|değişti|changed|yeni açıklama)/.test(text)) {
    return 'developing_story';
  }

  return 'known_risk';
}

function hasMatch(pattern, text) {
  return pattern.test(text);
}

function classifyEvent(item) {
  const text = `${item.title} ${item.summary || ''}`.toLowerCase();

  const geopoliticsPattern = /\b(iran|israel|usa|abd|missile|attack|ceasefire|sanction|war|ukraine|rusya|russia|nato|çatışma|conflict|kriz)\b/;
  const macroPattern = /\b(tcmb|merkez bankasi|faiz|interest rate|inflation|enflasyon|cpi|fed|ecb|rate hike|rate cut|monetary|para politikası)\b/;
  const commodityPattern = /\b(oil|brent|petrol|gold|altin|natural gas|doğalgaz|gas|lng|opec|ham petrol)\b/;
  const cryptoPattern = /\b(btc|bitcoin|eth|ethereum|crypto|stablecoin|blockchain|kripto|etf)\b/;
  const kapPattern = /\b(kap|geri alim|buyback|insider|ortak satis|sozlesme|ihale|temettü|dividend|kâr açıklama|earnings)\b/;
  const technologyPattern = /\b(yapay zeka|artificial intelligence|ai|chip|chips|semiconductor|cyber|cloud|electric vehicle|ev|5g)\b/;
  const turkeyMacroPattern = /\b(türkiye|turkey|bist|borsa istanbul|enflasyon|tüfe|üfe|tcmb|hazine|bütçe|cari açık|ihracat|ithalat)\b/;

  if (hasMatch(turkeyMacroPattern, text) && hasMatch(macroPattern, text)) {
    return {
      eventClass: 'Turkey Macro',
      eventType: 'turkey_macro_event',
      region: 'Turkey',
      channels: ['usdtry_move', 'bist_move', 'risk_repricing'],
      assetTags: ['usdtry', 'bist30', 'banks'],
      actorTags: ['central_bank', 'government'],
      countryTags: ['Turkey'],
      directnessToTurkey: 'direct',
      executionBias: 'mixed'
    };
  }

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
    severity: classifySeverity(`${item.title} ${item.summary || ''}`),
    novelty: classifyNovelty(item),
    credibility: item.credibility || 'medium'
  };
}

module.exports = {
  enrichClassification
};
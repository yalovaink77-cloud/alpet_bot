const SOURCE_CONFIG = {
  kap: {
    sourceType: 'scrape',
    sourceName: 'KAP',
    url: process.env.KAP_URL || 'https://www.kap.org.tr/tr',
    reliabilityScore: 15,
    credibility: 'high'
  },
  aa: {
    sourceType: 'rss',
    sourceName: 'Anadolu Ajansi',
    url: process.env.AA_RSS_URL || 'https://www.aa.com.tr/tr/rss/default?cat=ekonomi',
    reliabilityScore: 12,
    credibility: 'high'
  },
  bloomberght: {
    sourceType: 'rss',
    sourceName: 'BloombergHT',
    url: process.env.BLOOMBERGHT_RSS_URL || 'https://www.bloomberght.com/rss',
    reliabilityScore: 13,
    credibility: 'high'
  },
  tcmb: {
    sourceType: 'official',
    sourceName: 'TCMB',
    url: process.env.TCMB_URL || 'https://www.tcmb.gov.tr',
    reliabilityScore: 15,
    credibility: 'high'
  },
  reuters: {
    sourceType: 'rss',
    sourceName: 'Reuters',
    url: process.env.REUTERS_RSS_URL || 'https://feeds.reuters.com/reuters/businessNews',
    reliabilityScore: 14,
    credibility: 'high'
  },
  eia: {
    sourceType: 'rss',
    sourceName: 'OilPrice',
    url: process.env.OILPRICE_RSS_URL || 'https://oilprice.com/rss/main',
    reliabilityScore: 12,
    credibility: 'medium'
  },
  bbc_business: {
    sourceType: 'rss',
    sourceName: 'BBC Business',
    url: process.env.BBC_BUSINESS_RSS_URL || 'https://feeds.bbci.co.uk/news/business/rss.xml',
    reliabilityScore: 12,
    credibility: 'high'
  },
  opec: {
    sourceType: 'rss',
    sourceName: 'MarketWatch',
    url: process.env.MARKETWATCH_RSS_URL || 'https://www.marketwatch.com/rss/realtimeheadlines',
    reliabilityScore: 13,
    credibility: 'high'
  }
};

module.exports = {
  SOURCE_CONFIG
};

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
  }
};

module.exports = {
  SOURCE_CONFIG
};

const md5 = require('md5');

class Deduplicator {
  constructor() {
    this.seen = new Set();
  }

  buildHash(item) {
    return md5([item.sourceName, item.title, item.publishedAt].join('|'));
  }

  filter(items) {
    return items.filter((item) => {
      const hash = this.buildHash(item);
      if (this.seen.has(hash)) {
        return false;
      }

      this.seen.add(hash);
      return true;
    });
  }
}

module.exports = new Deduplicator();
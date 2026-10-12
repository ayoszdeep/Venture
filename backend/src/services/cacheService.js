const env = require("../config/env");

class MemoryCacheService {
  constructor() {
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const record = this.store.get(key);

    if (!record) {
      this.misses += 1;
      return null;
    }

    if (record.expiresAt < Date.now()) {
      this.store.delete(key);
      this.misses += 1;
      return null;
    }

    this.hits += 1;
    return record.value;
  }

  set(key, value, ttlSeconds = env.cacheTtlSeconds) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  has(key) {
    const record = this.store.get(key);
    if (!record) return false;
    if (record.expiresAt < Date.now()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  getStats() {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

module.exports = new MemoryCacheService();

const { LRUCache } = require('lru-cache');
const School = require('../models/School.model');

// In-process LRU cache: slug → School document
// max 500 entries, 5-minute TTL per entry
const cache = new LRUCache({
  max: 500,
  ttl: 5 * 60 * 1000, // 5 minutes in ms
});

/**
 * Get a School document by slug.
 * Returns the cached entry when available; otherwise queries MongoDB and caches
 * the result (or null for a miss so subsequent lookups return null quickly).
 *
 * @param {string} slug
 * @returns {Promise<School|null>}
 */
const getSchoolBySlug = async (slug) => {
  const key = slug.toLowerCase();

  if (cache.has(key)) {
    return cache.get(key);
  }

  const school = await School.findOne({ slug: key }).lean();
  cache.set(key, school); // cache null misses too (saves DB round-trips)
  return school;
};

/**
 * Invalidate a cached slug entry (call after slug or isActive changes).
 *
 * @param {string} slug
 */
const invalidate = (slug) => {
  cache.delete(slug.toLowerCase());
};

module.exports = { getSchoolBySlug, invalidate };

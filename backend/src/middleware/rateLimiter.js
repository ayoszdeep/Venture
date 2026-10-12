const rateLimit = require("express-rate-limit");

/**
 * Rate limiting strategy
 * -----------------------------------------------------------------------------
 * Two tiers are applied instead of one blanket limit, because auth endpoints and
 * read-heavy discovery endpoints have very different abuse profiles:
 *
 * 1. `authLimiter` (strict)  - guards /api/auth/login and /api/auth/register
 *    against credential stuffing and brute-force password guessing. Successful
 *    requests are not counted (`skipSuccessfulRequests`), so a legitimate user
 *    who logs in correctly never burns through their budget.
 *
 * 2. `apiLimiter` (generous) - protects the whole API surface from scraping and
 *    accidental client retry storms while staying far above normal usage.
 *
 * Counters are kept in memory. For a multi-replica deployment this store should
 * be swapped for the Redis store (`rate-limit-redis`) so the limit is shared
 * across instances; the middleware interface stays identical.
 */

const standardMessage = (message) => ({
  success: false,
  message,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: standardMessage(
    "Too many requests from this IP. Please try again in a few minutes."
  ),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: standardMessage(
    "Too many authentication attempts from this IP. Please try again later."
  ),
});

/**
 * AI endpoints call an external LLM provider, so they are both slow and costly.
 * A tight per-IP budget prevents a single client from exhausting API quota.
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: standardMessage(
    "AI study-plan quota exceeded for this hour. Please try again later."
  ),
});

module.exports = {
  aiLimiter,
  apiLimiter,
  authLimiter,
};

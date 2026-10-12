const rateLimit = require("express-rate-limit");

const standardMessage = (message) => ({
  success: false,
  message,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: standardMessage(
    "Too many requests from this IP. Please try again in a few minutes."
  ),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: standardMessage(
    "Too many authentication attempts from this IP. Please try again later."
  ),
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
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

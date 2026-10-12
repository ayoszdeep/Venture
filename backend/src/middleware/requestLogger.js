const logger = require("../config/logger");

/**
 * Logs one structured line per request once the response has been sent.
 *
 * Logging on the `finish` event rather than on the way in means the status code
 * and duration are known, so a single line carries the whole story of the
 * request. Server errors log at `error`, client errors at `warn`, so a log
 * query can separate "we broke" from "the caller sent something invalid".
 */
function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    const details = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
      ip: req.ip,
      // Set by the error handler, so a 4xx line says why it was rejected.
      ...(res.locals.errorMessage ? { reason: res.locals.errorMessage } : {}),
    };

    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${details.durationMs}ms`;

    if (res.statusCode >= 500) {
      logger.error(message, details);
    } else if (res.statusCode >= 400) {
      logger.warn(message, details);
    } else {
      logger.info(message, details);
    }
  });

  next();
}

module.exports = requestLogger;

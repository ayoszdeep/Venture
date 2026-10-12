const logger = require("../config/logger");

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

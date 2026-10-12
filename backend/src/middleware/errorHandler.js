const logger = require("../config/logger");

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;

  // Handed to requestLogger so one line carries both the outcome and the
  // reason, instead of every failed request producing two log entries.
  res.locals.errorMessage = error.message;

  // Only unexpected failures are logged here, with their stack. Expected 4xx
  // responses are already covered by the request log line.
  if (statusCode >= 500) {
    logger.error("Unhandled request error", {
      method: req.method,
      url: req.originalUrl,
      error,
    });
  }

  res.status(statusCode).json({
    success: false,
    message: error.message || "Something went wrong.",
    details: error.details || undefined,
  });
}

module.exports = errorHandler;

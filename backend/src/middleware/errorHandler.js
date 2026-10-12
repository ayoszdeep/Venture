const logger = require("../config/logger");

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;

  res.locals.errorMessage = error.message;

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

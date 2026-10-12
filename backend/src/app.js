const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");

const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");
const requestLogger = require("./middleware/requestLogger");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();

const isTestEnvironment = process.env.NODE_ENV === "test";

// Trust the first proxy hop so rate limiting sees the real client IP when the
// service runs behind a load balancer / reverse proxy.
app.set("trust proxy", 1);

// Security headers (CSP, HSTS, X-Frame-Options, no-sniff, referrer policy, ...)
app.use(helmet());
app.use(cors());

// Cap request body size: a study-abroad API never needs large payloads, and an
// explicit limit removes a cheap memory-exhaustion vector.
app.use(express.json({ limit: "100kb" }));

// Strip MongoDB operators ($gt, $ne, ...) and dotted keys out of user input so
// query/body values cannot be coerced into NoSQL injection operators.
app.use(mongoSanitize());

if (!isTestEnvironment) {
  app.use(requestLogger);
  app.use("/api", apiLimiter);
}

// All versions live in ./routes — see routes/index.js.
app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

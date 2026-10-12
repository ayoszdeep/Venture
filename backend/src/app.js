const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const morgan = require("morgan");

const aiRoutes = require("./routes/aiRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const healthRoutes = require("./routes/healthRoutes");
const programRoutes = require("./routes/programRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const universityRoutes = require("./routes/universityRoutes");
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");
const { apiLimiter, authLimiter } = require("./middleware/rateLimiter");

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
  app.use(morgan("dev"));
  app.use("/api", apiLimiter);
}

app.use("/api/health", healthRoutes);
app.use("/api/auth", isTestEnvironment ? authRoutes : [authLimiter, authRoutes]);
app.use("/api/universities", universityRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ai", aiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

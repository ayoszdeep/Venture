const express = require("express");

const aiRoutes = require("./aiRoutes");
const applicationRoutes = require("./applicationRoutes");
const authRoutes = require("./authRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const healthRoutes = require("./healthRoutes");
const programRoutes = require("./programRoutes");
const recommendationRoutes = require("./recommendationRoutes");
const universityRoutes = require("./universityRoutes");
const { authLimiter } = require("../../middleware/rateLimiter");

/**
 * v1 — the current stable contract.
 *
 * Offset pagination (`page`/`limit`) on the discovery endpoints, and responses
 * shaped `{ success, data, meta }`.
 */
const router = express.Router();

const isTestEnvironment = process.env.NODE_ENV === "test";

router.use("/health", healthRoutes);
// The stricter auth limiter is attached here rather than in app.js so it
// applies no matter which prefix this router is mounted under.
router.use("/auth", isTestEnvironment ? authRoutes : [authLimiter, authRoutes]);
router.use("/universities", universityRoutes);
router.use("/programs", programRoutes);
router.use("/recommendations", recommendationRoutes);
router.use("/applications", applicationRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/ai", aiRoutes);

module.exports = router;

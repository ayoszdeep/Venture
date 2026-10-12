const express = require("express");

const programRoutes = require("./programRoutes");
const v1AiRoutes = require("../v1/aiRoutes");
const v1ApplicationRoutes = require("../v1/applicationRoutes");
const v1AuthRoutes = require("../v1/authRoutes");
const v1DashboardRoutes = require("../v1/dashboardRoutes");
const v1HealthRoutes = require("../v1/healthRoutes");
const v1RecommendationRoutes = require("../v1/recommendationRoutes");
const v1UniversityRoutes = require("../v1/universityRoutes");
const { authLimiter } = require("../../middleware/rateLimiter");

/**
 * v2 — versioned per resource, not wholesale.
 *
 * Only `/programs` has a new contract (keyset pagination; see
 * `controllers/v2/programController.js`). Every other resource is served by the
 * v1 router, because re-exporting an unchanged handler under a new version is
 * how two copies of the same endpoint drift apart and start behaving
 * differently for no reason. When a resource does change, its own router gets
 * added to this folder and the v1 line below is dropped.
 */
const router = express.Router();

const isTestEnvironment = process.env.NODE_ENV === "test";

// Changed in v2.
router.use("/programs", programRoutes);

// Unchanged from v1.
router.use("/health", v1HealthRoutes);
router.use(
  "/auth",
  isTestEnvironment ? v1AuthRoutes : [authLimiter, v1AuthRoutes]
);
router.use("/universities", v1UniversityRoutes);
router.use("/recommendations", v1RecommendationRoutes);
router.use("/applications", v1ApplicationRoutes);
router.use("/dashboard", v1DashboardRoutes);
router.use("/ai", v1AiRoutes);

module.exports = router;

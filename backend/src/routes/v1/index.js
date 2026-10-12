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

const router = express.Router();

const isTestEnvironment = process.env.NODE_ENV === "test";

router.use("/health", healthRoutes);

router.use("/auth", isTestEnvironment ? authRoutes : [authLimiter, authRoutes]);
router.use("/universities", universityRoutes);
router.use("/programs", programRoutes);
router.use("/recommendations", recommendationRoutes);
router.use("/applications", applicationRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/ai", aiRoutes);

module.exports = router;

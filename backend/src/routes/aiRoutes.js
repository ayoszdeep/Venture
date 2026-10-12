const express = require("express");

const { getStudyPlan } = require("../controllers/aiController");
const { requireAuth } = require("../middleware/auth");
const { aiLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

const isTestEnvironment = process.env.NODE_ENV === "test";

router.get(
  "/study-plan/:studentId",
  ...(isTestEnvironment ? [] : [aiLimiter]),
  requireAuth,
  getStudyPlan
);

module.exports = router;

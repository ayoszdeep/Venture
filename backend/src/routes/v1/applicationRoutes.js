const express = require("express");

const {
  createApplication,
  listApplications,
  updateApplicationStatus,
} = require("../../controllers/applicationController");
const { requireAuth, requireRole } = require("../../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, listApplications);
router.post("/", requireAuth, createApplication);
router.patch("/:id/status", requireAuth, requireRole("counselor"), updateApplicationStatus);

module.exports = router;

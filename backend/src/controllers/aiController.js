const { buildStudyPlan } = require("../services/aiStudyPlanService");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");

/**
 * GET /api/ai/study-plan/:studentId
 *
 * Returns an AI-generated, phased study-abroad plan grounded on the student's
 * aggregation-ranked program shortlist. Students may only request their own
 * plan; counselors may request any student's plan.
 */
const getStudyPlan = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const refresh = req.query.refresh === "true";

  if (req.user.role !== "counselor" && req.user._id.toString() !== studentId) {
    throw new HttpError(403, "You can only view your own study plan.");
  }

  const payload = await buildStudyPlan(studentId, { refresh });

  res.json({
    success: true,
    ...payload,
  });
});

module.exports = {
  getStudyPlan,
};

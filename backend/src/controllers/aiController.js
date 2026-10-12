const { buildStudyPlan } = require("../services/aiStudyPlanService");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");

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

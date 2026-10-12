const jwt = require("jsonwebtoken");
const env = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");
const {
  buildProgramRecommendations,
} = require("../services/recommendationService");

const getRecommendations = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.replace("Bearer ", "").trim();
      const decoded = jwt.verify(token, env.jwtSecret);
      if (decoded.role !== "counselor" && decoded.sub !== studentId) {
        throw new HttpError(403, "You can only view your own recommendations.");
      }
    } catch (err) {
      if (err.statusCode) throw err;
      throw new HttpError(401, "Invalid or expired token.");
    }
  }

  const payload = await buildProgramRecommendations(studentId);

  res.json({
    success: true,
    ...payload,
  });
});

module.exports = {
  getRecommendations,
};

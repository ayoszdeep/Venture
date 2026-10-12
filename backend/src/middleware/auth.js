const jwt = require("jsonwebtoken");

const env = require("../config/env");
const Student = require("../models/Student");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");

const requireAuth = asyncHandler(async (req, res, next) => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    throw new HttpError(401, "Authorization token missing.");
  }

  const token = authorizationHeader.replace("Bearer ", "").trim();

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const student = await Student.findById(decoded.sub).select("-password");

    if (!student) {
      throw new HttpError(401, "Authenticated user no longer exists.");
    }

    req.user = student;
    next();
  } catch (error) {
    throw new HttpError(401, "Invalid or expired token.");
  }
});

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      throw new HttpError(401, "Authentication required.");
    }

    if (!roles.includes(req.user.role)) {
      throw new HttpError(
        403,
        `Access denied. Requires one of: ${roles.join(", ")}.`
      );
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};

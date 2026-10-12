const jwt = require("jsonwebtoken");

const env = require("../config/env");
const { studentRepository } = require("../repositories");
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
    // Checked against the database on every request, so a token belonging to a
    // deleted account stops working immediately rather than at expiry.
    const student = await studentRepository.findByIdWithoutPassword(
      decoded.sub
    );

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

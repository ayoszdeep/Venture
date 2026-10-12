const jwt = require("jsonwebtoken");

const env = require("../config/env");
const logger = require("../config/logger");
const { studentRepository } = require("../repositories");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const register = asyncHandler(async (req, res) => {
  const {
    fullName,
    name,
    email,
    password,
    targetCountries,
    interestedFields,
    preferredIntake,
    maxBudgetUsd,
    englishTest,
  } = req.body;

  const displayName = (fullName || name || "").trim();
  if (!displayName) {
    throw new HttpError(400, "Full name is required.");
  }

  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    throw new HttpError(400, "A valid email address is required.");
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters long.");
  }

  const existingStudent = await studentRepository.findByEmail(normalizedEmail);
  if (existingStudent) {
    throw new HttpError(409, "User with this email already exists.");
  }

  const newStudent = await studentRepository.create({
    fullName: displayName,
    email: normalizedEmail,
    password,
    role: "student",
    targetCountries: Array.isArray(targetCountries) ? targetCountries : [],
    interestedFields: Array.isArray(interestedFields) ? interestedFields : [],
    preferredIntake: preferredIntake || "",
    maxBudgetUsd: typeof maxBudgetUsd === "number" ? maxBudgetUsd : 0,
    englishTest: englishTest || { exam: "IELTS", score: 0 },
  });

  const token = jwt.sign(
    {
      sub: newStudent._id.toString(),
      role: newStudent.role,
      email: newStudent.email,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  logger.info("Student registered", {
    studentId: newStudent._id.toString(),
    email: newStudent.email,
  });

  res.status(201).json({
    success: true,
    message: "Registration successful",
    data: {
      id: newStudent._id,
      name: newStudent.fullName,
      fullName: newStudent.fullName,
      email: newStudent.email,
      role: newStudent.role,
      token,
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new HttpError(400, "Email and password are required.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const student = await studentRepository.findByEmail(normalizedEmail);

  if (!student) {

    logger.warn("Login attempt for unknown email", { email: normalizedEmail });
    throw new HttpError(401, "Invalid email or password.");
  }

  const isPasswordValid = await student.comparePassword(password);
  if (!isPasswordValid) {
    logger.warn("Login attempt with invalid password", {
      studentId: student._id.toString(),
    });
    throw new HttpError(401, "Invalid email or password.");
  }

  const token = jwt.sign(
    {
      sub: student._id.toString(),
      role: student.role,
      email: student.email,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  res.json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: {
        id: student._id,
        name: student.fullName,
        fullName: student.fullName,
        email: student.email,
        role: student.role,
      },
    },
  });
});

const me = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user._id,
      name: req.user.fullName,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      targetCountries: req.user.targetCountries,
      interestedFields: req.user.interestedFields,
      preferredIntake: req.user.preferredIntake,
      maxBudgetUsd: req.user.maxBudgetUsd,
      englishTest: req.user.englishTest,
      profileComplete: req.user.profileComplete,
    },
  });
});

module.exports = {
  register,
  login,
  me,
};

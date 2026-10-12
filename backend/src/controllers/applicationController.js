const mongoose = require("mongoose");
const Application = require("../models/Application");
const Program = require("../models/Program");
const {
  applicationStatuses,
  validStatusTransitions,
} = require("../config/constants");
const cacheService = require("../services/cacheService");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");

const listApplications = asyncHandler(async (req, res) => {
  const { studentId, status } = req.query;
  const filters = {};

  // Role-based filtering: students can only see their own applications
  if (req.user && req.user.role === "student") {
    filters.student = req.user._id;
  } else if (studentId) {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new HttpError(400, "Invalid student ID format.");
    }
    filters.student = studentId;
  }

  if (status) {
    if (!applicationStatuses.includes(status)) {
      throw new HttpError(400, `Invalid status filter: ${status}`);
    }
    filters.status = status;
  }

  const applications = await Application.find(filters)
    .populate("student", "fullName email role")
    .populate("program", "title degreeLevel tuitionFeeUsd country")
    .populate("university", "name country city")
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: applications,
  });
});

const createApplication = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const programId = req.body.programId || req.body.program;
  const intake = (req.body.intake || "").trim();
  const note = req.body.note || "Application submitted by student.";
  const status = req.body.status || "submitted";

  if (!programId) {
    throw new HttpError(400, "Program ID is required.");
  }

  if (!mongoose.Types.ObjectId.isValid(programId)) {
    throw new HttpError(400, "Invalid program ID format.");
  }

  if (!intake) {
    throw new HttpError(400, "Intake is required.");
  }

  if (!["draft", "submitted"].includes(status)) {
    throw new HttpError(400, "Initial application status must be 'draft' or 'submitted'.");
  }

  const program = await Program.findById(programId);
  if (!program) {
    throw new HttpError(404, "Program not found.");
  }

  // Pre-check for duplicate application for (student, program, intake)
  const existingApplication = await Application.findOne({
    student: studentId,
    program: program._id,
    intake,
  });

  if (existingApplication) {
    throw new HttpError(
      409,
      `You have already submitted an application for ${program.title} (${intake}).`
    );
  }

  try {
    const application = await Application.create({
      student: studentId,
      program: program._id,
      university: program.university,
      destinationCountry: program.country,
      intake,
      status,
      timeline: [
        {
          status,
          note,
          changedAt: new Date(),
        },
      ],
    });

    const populatedApplication = await Application.findById(application._id)
      .populate("student", "fullName email role")
      .populate("program", "title degreeLevel tuitionFeeUsd country")
      .populate("university", "name country city");

    cacheService.delete("dashboard-overview");

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: populatedApplication,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new HttpError(
        409,
        `Duplicate application detected for ${program.title} (${intake}).`
      );
    }
    throw error;
  }
});

const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status: requestedStatus, note } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, "Invalid application ID format.");
  }

  if (!requestedStatus) {
    throw new HttpError(400, "New status is required.");
  }

  if (!applicationStatuses.includes(requestedStatus)) {
    throw new HttpError(
      400,
      `Invalid status "${requestedStatus}". Permitted statuses: ${applicationStatuses.join(
        ", "
      )}`
    );
  }

  const application = await Application.findById(id);
  if (!application) {
    throw new HttpError(404, "Application not found.");
  }

  const currentStatus = application.status;

  // Enforce workflow state machine transitions
  const allowedNextStatuses = validStatusTransitions[currentStatus] || [];
  if (!allowedNextStatuses.includes(requestedStatus)) {
    throw new HttpError(
      400,
      `Cannot transition application status from "${currentStatus}" to "${requestedStatus}". Permitted next statuses: ${
        allowedNextStatuses.length > 0 ? allowedNextStatuses.join(", ") : "none"
      }`
    );
  }

  const transitionNote =
    note ||
    `Status updated from ${currentStatus} to ${requestedStatus} by ${
      req.user.fullName || req.user.email
    }`;

  application.status = requestedStatus;
  application.timeline.push({
    status: requestedStatus,
    note: transitionNote,
    changedAt: new Date(),
  });

  await application.save();

  const populated = await Application.findById(application._id)
    .populate("student", "fullName email role")
    .populate("program", "title degreeLevel tuitionFeeUsd country")
    .populate("university", "name country city");

  cacheService.delete("dashboard-overview");

  res.json({
    success: true,
    message: "Application status updated successfully",
    data: populated,
  });
});

module.exports = {
  createApplication,
  listApplications,
  updateApplicationStatus,
};

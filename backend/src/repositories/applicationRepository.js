const Application = require("../models/Application");

/**
 * Data access for applications.
 *
 * Every read names the fields it needs from the joined collections rather than
 * populating whole documents, so a list response does not drag a student's
 * entire profile along with it.
 */

const STUDENT_FIELDS = "fullName email role";
const PROGRAM_FIELDS = "title degreeLevel tuitionFeeUsd country";
const UNIVERSITY_FIELDS = "name country city";

function withRelations(query) {
  return query
    .populate("student", STUDENT_FIELDS)
    .populate("program", PROGRAM_FIELDS)
    .populate("university", UNIVERSITY_FIELDS);
}

function findMany(filters) {
  return withRelations(Application.find(filters))
    .sort({ createdAt: -1 })
    .lean();
}

function findByIdWithRelations(id) {
  return withRelations(Application.findById(id));
}

function findById(id) {
  return Application.findById(id).lean();
}

function findExisting({ student, program, intake }) {
  return Application.findOne({ student, program, intake }).lean();
}

function create(applicationData) {
  return Application.create(applicationData);
}

/**
 * Moves an application to a new status and appends the matching audit entry in
 * a single atomic update, so the status and its timeline record can never
 * disagree the way a read-modify-write pair could.
 */
function appendStatusTransition(id, { status, note }) {
  return withRelations(
    Application.findByIdAndUpdate(
      id,
      {
        $set: { status },
        $push: { timeline: { status, note, changedAt: new Date() } },
      },
      { new: true, runValidators: true }
    )
  );
}

function countAll() {
  return Application.countDocuments();
}

/** Seeding only. */
function insertMany(applications) {
  return Application.insertMany(applications);
}

function deleteAll() {
  return Application.deleteMany({});
}

function countByStatus() {
  return Application.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
}

function topDestinationCountries(limit = 5) {
  return Application.aggregate([
    { $group: { _id: "$destinationCountry", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
}

module.exports = {
  appendStatusTransition,
  countAll,
  countByStatus,
  create,
  deleteAll,
  insertMany,
  findById,
  findByIdWithRelations,
  findExisting,
  findMany,
  topDestinationCountries,
};

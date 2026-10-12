const Application = require("../models/Application");

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

const Student = require("../models/Student");

/**
 * Data access for students.
 *
 * `findByEmail` and `create` deliberately return hydrated Mongoose documents,
 * because the password hashing hook and `comparePassword()` live on the model.
 * Read paths that only feed a response return `.lean()` objects instead, which
 * skips document hydration.
 */

function findByEmail(email) {
  return Student.findOne({ email });
}

function findById(id) {
  return Student.findById(id);
}

function findByIdLean(id) {
  return Student.findById(id).lean();
}

function findByIdWithoutPassword(id) {
  return Student.findById(id).select("-password");
}

function create(studentData) {
  return Student.create(studentData);
}

function countAll() {
  return Student.countDocuments();
}

/**
 * Seeding only. `create()` rather than `insertMany()` because students need the
 * password-hashing save hook, which `insertMany` skips.
 */
function createMany(students) {
  return Student.create(students);
}

function deleteAll() {
  return Student.deleteMany({});
}

module.exports = {
  countAll,
  create,
  createMany,
  deleteAll,
  findByEmail,
  findById,
  findByIdLean,
  findByIdWithoutPassword,
};

const Student = require("../models/Student");

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

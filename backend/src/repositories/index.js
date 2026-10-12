/**
 * Repository layer.
 *
 * Every Mongoose call in the codebase lives in this folder. Controllers and
 * services talk to these functions instead of importing models directly, which
 * keeps query construction in one place per collection and means a controller
 * can be read without knowing MongoDB.
 */

const applicationRepository = require("./applicationRepository");
const programRepository = require("./programRepository");
const studentRepository = require("./studentRepository");
const universityRepository = require("./universityRepository");

module.exports = {
  applicationRepository,
  programRepository,
  studentRepository,
  universityRepository,
};

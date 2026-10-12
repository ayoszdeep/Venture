const University = require("../models/University");

/**
 * Data access for universities.
 */

/**
 * Runs the page query and the matching count concurrently. Sequentially these
 * two round trips would roughly double the latency of every list request.
 */
async function findPaginated({ filters, sort, skip, limit }) {
  const [items, total] = await Promise.all([
    University.find(filters).sort(sort).skip(skip).limit(limit).lean(),
    University.countDocuments(filters),
  ]);

  return { items, total };
}

function findPopular(limit = 6) {
  return University.find()
    .sort({ popularScore: -1, qsRanking: 1 })
    .limit(limit)
    .lean();
}

function countAll() {
  return University.countDocuments();
}

/** Seeding only. */
function insertMany(universities) {
  return University.insertMany(universities);
}

function deleteAll() {
  return University.deleteMany({});
}

module.exports = {
  countAll,
  deleteAll,
  insertMany,
  findPaginated,
  findPopular,
};

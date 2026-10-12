const University = require("../models/University");

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

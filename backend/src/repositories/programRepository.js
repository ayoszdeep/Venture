const Program = require("../models/Program");

/**
 * Data access for programs.
 */

function findById(id) {
  return Program.findById(id);
}

async function findPaginated({ filters, sort, skip, limit }) {
  const [items, total] = await Promise.all([
    Program.find(filters).sort(sort).skip(skip).limit(limit).lean(),
    Program.countDocuments(filters),
  ]);

  return { items, total };
}

/**
 * Keyset ("cursor") page used by the v2 discovery contract.
 *
 * One extra document is fetched beyond the requested limit purely to answer
 * "is there a next page?" without a second count query. Offset pagination needs
 * `countDocuments` for that, and `skip` makes the database walk and discard
 * every earlier document; keyset pagination seeks straight into the index.
 */
async function findByCursor({ filters, sort, limit }) {
  const items = await Program.find(filters)
    .sort(sort)
    .limit(limit + 1)
    .lean();

  const hasMore = items.length > limit;

  return { items: hasMore ? items.slice(0, limit) : items, hasMore };
}

function aggregate(pipeline) {
  return Program.aggregate(pipeline);
}

function countAll() {
  return Program.countDocuments();
}

/** Seeding only. */
function insertMany(programs) {
  return Program.insertMany(programs);
}

function deleteAll() {
  return Program.deleteMany({});
}

module.exports = {
  aggregate,
  countAll,
  deleteAll,
  insertMany,
  findByCursor,
  findById,
  findPaginated,
};

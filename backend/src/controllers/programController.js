const Program = require("../models/Program");
const asyncHandler = require("../utils/asyncHandler");

function parseBoolean(value) {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}

const listPrograms = asyncHandler(async (req, res) => {
  const {
    country,
    degreeLevel,
    intake,
    field,
    q,
    search,
    maxTuition,
    maxBudget,
    scholarshipAvailable,
    scholarship,
    sortBy = "relevance",
    order = "asc",
    page = 1,
    limit = 10,
  } = req.query;

  const filters = {};

  if (country) {
    filters.country = { $regex: new RegExp(`^${country}$`, "i") };
  }

  if (degreeLevel) {
    filters.degreeLevel = { $regex: new RegExp(`^${degreeLevel}$`, "i") };
  }

  if (field) {
    filters.field = { $regex: field, $options: "i" };
  }

  if (intake) {
    filters.intakes = { $regex: new RegExp(`^${intake}$`, "i") };
  }

  const budget = maxTuition || maxBudget;
  if (budget) {
    filters.tuitionFeeUsd = { $lte: Number(budget) };
  }

  const scholarshipFlag = parseBoolean(scholarshipAvailable ?? scholarship);
  if (typeof scholarshipFlag === "boolean") {
    filters.scholarshipAvailable = scholarshipFlag;
  }

  const searchTerm = (q || search || "").trim();
  if (searchTerm) {
    filters.$or = [
      { title: { $regex: searchTerm, $options: "i" } },
      { universityName: { $regex: searchTerm, $options: "i" } },
      { field: { $regex: searchTerm, $options: "i" } },
      { country: { $regex: searchTerm, $options: "i" } },
    ];
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 50);

  const direction = order.toLowerCase() === "desc" ? -1 : 1;

  let sortCriteria = { scholarshipAvailable: -1, tuitionFeeUsd: 1, _id: 1 };
  if (sortBy === "tuitionAsc") {
    sortCriteria = { tuitionFeeUsd: 1, _id: 1 };
  } else if (sortBy === "tuitionDesc") {
    sortCriteria = { tuitionFeeUsd: -1, _id: 1 };
  } else if (sortBy === "tuition") {
    sortCriteria = { tuitionFeeUsd: direction, _id: 1 };
  } else if (sortBy === "name" || sortBy === "title") {
    sortCriteria = { title: direction, _id: 1 };
  } else if (sortBy === "minimumIelts") {
    sortCriteria = { minimumIelts: direction, _id: 1 };
  }

  const [items, total] = await Promise.all([
    Program.find(filters)
      .sort(sortCriteria)
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Program.countDocuments(filters),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const paginationData = {
    page: pageNumber,
    limit: pageSize,
    total,
    totalPages,
  };

  res.json({
    success: true,
    data: items,
    meta: paginationData,
    pagination: paginationData,
  });
});

module.exports = {
  listPrograms,
};

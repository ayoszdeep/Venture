const University = require("../models/University");
const cacheService = require("../services/cacheService");
const asyncHandler = require("../utils/asyncHandler");

function parseBoolean(value) {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}

const listUniversities = asyncHandler(async (req, res) => {
  const {
    country,
    partnerType,
    q,
    search,
    scholarshipAvailable,
    scholarship,
    sortBy = "popular",
    order = "desc",
    page = 1,
    limit = 10,
  } = req.query;

  const filters = {};

  if (country) {
    filters.country = { $regex: new RegExp(`^${country}$`, "i") };
  }

  if (partnerType) {
    filters.partnerType = partnerType;
  }

  const scholarshipFlag = parseBoolean(scholarshipAvailable ?? scholarship);
  if (typeof scholarshipFlag === "boolean") {
    filters.scholarshipAvailable = scholarshipFlag;
  }

  const searchTerm = (q || search || "").trim();
  if (searchTerm) {
    filters.$or = [
      { name: { $regex: searchTerm, $options: "i" } },
      { country: { $regex: searchTerm, $options: "i" } },
      { city: { $regex: searchTerm, $options: "i" } },
      { tags: { $regex: searchTerm, $options: "i" } },
    ];
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 50);

  const direction = order.toLowerCase() === "asc" ? 1 : -1;

  let sortCriteria = { popularScore: -1, qsRanking: 1, _id: 1 };
  if (sortBy === "name") {
    sortCriteria = { name: direction, _id: 1 };
  } else if (sortBy === "ranking" || sortBy === "qsRanking") {
    sortCriteria = { qsRanking: direction, popularScore: -1, _id: 1 };
  } else if (sortBy === "popular" || sortBy === "popularScore") {
    sortCriteria = { popularScore: direction, qsRanking: 1, _id: 1 };
  }

  const [items, total] = await Promise.all([
    University.find(filters)
      .sort(sortCriteria)
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    University.countDocuments(filters),
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

const listPopularUniversities = asyncHandler(async (req, res) => {
  const cacheKey = "popular-universities";
  const cachedPayload = cacheService.get(cacheKey);

  if (cachedPayload) {
    return res.json({
      success: true,
      data: cachedPayload,
      meta: {
        cache: "hit",
      },
    });
  }

  const universities = await University.find()
    .sort({ popularScore: -1, qsRanking: 1 })
    .limit(6)
    .lean();

  cacheService.set(cacheKey, universities);

  res.json({
    success: true,
    data: universities,
    meta: {
      cache: "miss",
    },
  });
});

module.exports = {
  listPopularUniversities,
  listUniversities,
};

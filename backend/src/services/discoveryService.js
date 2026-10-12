const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;

function parseBoolean(value) {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}

function exactInsensitive(value) {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { $regex: new RegExp(`^${escaped}$`, "i") };
}

function parsePagination({ page = 1, limit = DEFAULT_PAGE_SIZE } = {}) {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number(limit) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );

  return { pageNumber, pageSize, skip: (pageNumber - 1) * pageSize };
}

function buildProgramFilters(query) {
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
  } = query;

  const filters = {};

  if (country) filters.country = exactInsensitive(country);
  if (degreeLevel) filters.degreeLevel = exactInsensitive(degreeLevel);
  if (intake) filters.intakes = exactInsensitive(intake);
  if (field) filters.field = { $regex: field, $options: "i" };

  const budget = maxTuition || maxBudget;
  if (budget) filters.tuitionFeeUsd = { $lte: Number(budget) };

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

  return filters;
}

function buildProgramSort({ sortBy = "relevance", order = "asc" } = {}) {
  const direction = String(order).toLowerCase() === "desc" ? -1 : 1;

  if (sortBy === "tuitionAsc") return { tuitionFeeUsd: 1, _id: 1 };
  if (sortBy === "tuitionDesc") return { tuitionFeeUsd: -1, _id: -1 };
  if (sortBy === "tuition") return { tuitionFeeUsd: direction, _id: direction };
  if (sortBy === "name" || sortBy === "title") {
    return { title: direction, _id: direction };
  }
  if (sortBy === "minimumIelts") {
    return { minimumIelts: direction, _id: direction };
  }

  return { scholarshipAvailable: -1, tuitionFeeUsd: 1, _id: 1 };
}

function buildUniversityFilters(query) {
  const { country, partnerType, q, search, scholarshipAvailable, scholarship } =
    query;

  const filters = {};

  if (country) filters.country = exactInsensitive(country);
  if (partnerType) filters.partnerType = partnerType;

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

  return filters;
}

function buildUniversitySort({ sortBy = "popular", order = "desc" } = {}) {
  const direction = String(order).toLowerCase() === "asc" ? 1 : -1;

  if (sortBy === "name") return { name: direction, _id: 1 };
  if (sortBy === "ranking" || sortBy === "qsRanking") {
    return { qsRanking: direction, popularScore: -1, _id: 1 };
  }
  if (sortBy === "popular" || sortBy === "popularScore") {
    return { popularScore: direction, qsRanking: 1, _id: 1 };
  }

  return { popularScore: -1, qsRanking: 1, _id: 1 };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildProgramFilters,
  buildProgramSort,
  buildUniversityFilters,
  buildUniversitySort,
  parseBoolean,
  parsePagination,
};

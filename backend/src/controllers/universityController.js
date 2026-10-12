const logger = require("../config/logger");
const { universityRepository } = require("../repositories");
const cacheService = require("../services/cacheService");
const {
  buildUniversityFilters,
  buildUniversitySort,
  parsePagination,
} = require("../services/discoveryService");
const asyncHandler = require("../utils/asyncHandler");

const POPULAR_CACHE_KEY = "popular-universities";

const listUniversities = asyncHandler(async (req, res) => {
  const filters = buildUniversityFilters(req.query);
  const sort = buildUniversitySort(req.query);
  const { pageNumber, pageSize, skip } = parsePagination(req.query);

  const { items, total } = await universityRepository.findPaginated({
    filters,
    sort,
    skip,
    limit: pageSize,
  });

  const paginationData = {
    page: pageNumber,
    limit: pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };

  res.json({
    success: true,
    data: items,
    meta: paginationData,
    // Kept alongside `meta` for backwards compatibility with existing clients.
    pagination: paginationData,
  });
});

/**
 * Cached: this list is identical for every visitor and changes rarely, so it is
 * the clearest win for a TTL cache.
 */
const listPopularUniversities = asyncHandler(async (req, res) => {
  const cachedPayload = cacheService.get(POPULAR_CACHE_KEY);

  if (cachedPayload) {
    return res.json({
      success: true,
      data: cachedPayload,
      meta: { cache: "hit" },
    });
  }

  const universities = await universityRepository.findPopular();
  cacheService.set(POPULAR_CACHE_KEY, universities);

  logger.debug("Popular universities cache populated", {
    count: universities.length,
  });

  res.json({
    success: true,
    data: universities,
    meta: { cache: "miss" },
  });
});

module.exports = {
  listPopularUniversities,
  listUniversities,
};

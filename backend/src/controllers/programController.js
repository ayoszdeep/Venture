const { programRepository } = require("../repositories");
const {
  buildProgramFilters,
  buildProgramSort,
  parsePagination,
} = require("../services/discoveryService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/v1/programs
 *
 * Offset pagination. Simple for a client to drive ("give me page 4") and it can
 * report a total page count, which keyset pagination cannot.
 */
const listPrograms = asyncHandler(async (req, res) => {
  const filters = buildProgramFilters(req.query);
  const sort = buildProgramSort(req.query);
  const { pageNumber, pageSize, skip } = parsePagination(req.query);

  const { items, total } = await programRepository.findPaginated({
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

module.exports = {
  listPrograms,
};

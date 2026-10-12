const { programRepository } = require("../repositories");
const {
  buildProgramFilters,
  buildProgramSort,
  parsePagination,
} = require("../services/discoveryService");
const asyncHandler = require("../utils/asyncHandler");

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

    pagination: paginationData,
  });
});

module.exports = {
  listPrograms,
};

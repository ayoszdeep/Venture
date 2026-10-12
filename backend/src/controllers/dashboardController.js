const {
  applicationRepository,
  programRepository,
  studentRepository,
} = require("../repositories");
const cacheService = require("../services/cacheService");
const asyncHandler = require("../utils/asyncHandler");

const CACHE_KEY = "dashboard-overview";

const getOverview = asyncHandler(async (req, res) => {
  const cachedPayload = cacheService.get(CACHE_KEY);

  if (cachedPayload) {
    return res.json({
      success: true,
      data: cachedPayload,
      meta: { cache: "hit" },
    });
  }

  const [
    totalStudents,
    totalPrograms,
    totalApplications,
    statusBreakdown,
    topCountries,
  ] = await Promise.all([
    studentRepository.countAll(),
    programRepository.countAll(),
    applicationRepository.countAll(),
    applicationRepository.countByStatus(),
    applicationRepository.topDestinationCountries(),
  ]);

  const payload = {
    totalStudents,
    totalPrograms,
    totalApplications,
    statusBreakdown,
    topCountries,
  };

  cacheService.set(CACHE_KEY, payload);

  res.json({
    success: true,
    data: payload,
    meta: { cache: "miss" },
  });
});

module.exports = {
  getOverview,
};

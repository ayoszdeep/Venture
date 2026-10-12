const {
  applicationRepository,
  programRepository,
  studentRepository,
} = require("../repositories");
const cacheService = require("../services/cacheService");
const asyncHandler = require("../utils/asyncHandler");

const CACHE_KEY = "dashboard-overview";

/**
 * Platform-wide counters for the dashboard.
 *
 * Five independent aggregations, so they are issued in parallel rather than in
 * sequence. The result is cached and the cache is dropped whenever an
 * application changes, because a counselor who just moved an application and
 * still sees the old numbers will assume the app is broken.
 */
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

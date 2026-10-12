const mongoose = require("mongoose");

const { programRepository, studentRepository } = require("../repositories");
const HttpError = require("../utils/httpError");

async function buildProgramRecommendations(studentId) {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    throw new HttpError(400, "Invalid student ID format.");
  }

  const student = await studentRepository.findByIdLean(studentId);

  if (!student) {
    throw new HttpError(404, "Student not found.");
  }

  const targetCountries = Array.isArray(student.targetCountries)
    ? student.targetCountries
    : [];
  const interestedFields = Array.isArray(student.interestedFields)
    ? student.interestedFields
    : [];
  const studentIelts = student.englishTest?.score || 0;
  const maxBudget = student.maxBudgetUsd || Infinity;
  const preferredIntake = student.preferredIntake || "";

  const pipeline = [];

  // Match stage: if student has target countries, narrow candidate pool
  if (targetCountries.length > 0) {
    pipeline.push({
      $match: {
        country: { $in: targetCountries },
      },
    });
  }

  // Lookup university information
  pipeline.push({
    $lookup: {
      from: "universities",
      localField: "university",
      foreignField: "_id",
      as: "universityDetails",
    },
  });

  pipeline.push({
    $unwind: {
      path: "$universityDetails",
      preserveNullAndEmptyArrays: true,
    },
  });

  // Calculate matching criteria and score components
  pipeline.push({
    $addFields: {
      countryMatch: {
        $in: ["$country", targetCountries],
      },
      fieldMatch: {
        $in: ["$field", interestedFields],
      },
      budgetMatch: {
        $lte: ["$tuitionFeeUsd", maxBudget],
      },
      intakeMatch: preferredIntake
        ? { $in: [preferredIntake, "$intakes"] }
        : false,
      ieltsMatch: {
        $lte: ["$minimumIelts", studentIelts],
      },
    },
  });

  pipeline.push({
    $addFields: {
      countryScore: { $cond: ["$countryMatch", 35, 0] },
      fieldScore: { $cond: ["$fieldMatch", 30, 0] },
      budgetScore: { $cond: ["$budgetMatch", 20, 0] },
      intakeScore: { $cond: ["$intakeMatch", 10, 0] },
      ieltsScore: { $cond: ["$ieltsMatch", 5, 0] },
    },
  });

  pipeline.push({
    $addFields: {
      matchScore: {
        $add: [
          "$countryScore",
          "$fieldScore",
          "$budgetScore",
          "$intakeScore",
          "$ieltsScore",
        ],
      },
      reasons: {
        $filter: {
          input: [
            {
              $cond: [
                "$countryMatch",
                { $concat: ["Preferred country match: ", "$country"] },
                null,
              ],
            },
            {
              $cond: [
                "$fieldMatch",
                { $concat: ["Field alignment: ", "$field"] },
                null,
              ],
            },
            {
              $cond: [
                "$budgetMatch",
                "Tuition is within your budget",
                null,
              ],
            },
            {
              $cond: [
                "$intakeMatch",
                {
                  $concat: [
                    "Preferred intake available: ",
                    preferredIntake,
                  ],
                },
                null,
              ],
            },
            {
              $cond: [
                "$ieltsMatch",
                "English test score meets requirement",
                null,
              ],
            },
          ],
          as: "reason",
          cond: { $ne: ["$$reason", null] },
        },
      },
    },
  });

  pipeline.push({
    $sort: {
      matchScore: -1,
      tuitionFeeUsd: 1,
      _id: 1,
    },
  });

  pipeline.push({
    $limit: 5,
  });

  const recommendations = await programRepository.aggregate(pipeline);

  return {
    data: {
      student: {
        id: student._id,
        fullName: student.fullName,
        targetCountries: student.targetCountries,
        interestedFields: student.interestedFields,
        maxBudgetUsd: student.maxBudgetUsd,
        preferredIntake: student.preferredIntake,
        englishTest: student.englishTest,
      },
      recommendations,
    },
    meta: {
      engine: "mongodb-aggregation-pipeline",
      totalRecommendations: recommendations.length,
    },
  };
}

module.exports = {
  buildProgramRecommendations,
};

const env = require("../config/env");
const logger = require("../config/logger");
const cacheService = require("./cacheService");
const HttpError = require("../utils/httpError");
const { buildProgramRecommendations } = require("./recommendationService");

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 20000;

const SYSTEM_PROMPT = `You are a senior study-abroad counselor at Waygood.
You will be given a student's profile and a pre-computed, database-ranked shortlist of programs.
Produce a practical application plan.

Hard rules:
- Only reference universities and programs present in the supplied shortlist. Never invent any.
- Never contradict the supplied tuition figures, IELTS requirements or intakes.
- Respond with ONLY valid minified JSON, no markdown fences and no commentary.

Use exactly this JSON shape:
{
  "summary": "<2-3 sentence assessment of the student's positioning>",
  "shortlistStrategy": [
    { "programTitle": "<from shortlist>", "universityName": "<from shortlist>", "category": "ambitious|balanced|safe", "rationale": "<1 sentence>" }
  ],
  "timeline": [
    { "phase": "<e.g. Months 1-2>", "focus": "<objective>", "actions": ["<action>", "<action>"] }
  ],
  "testPreparation": { "currentStanding": "<1 sentence>", "recommendations": ["<action>"] },
  "budgetAdvice": ["<funding or affordability note>"],
  "risks": ["<risk the student should plan around>"]
}`;

function buildUserPrompt(student, recommendations) {
  const profile = {
    targetCountries: student.targetCountries,
    interestedFields: student.interestedFields,
    maxBudgetUsd: student.maxBudgetUsd,
    preferredIntake: student.preferredIntake,
    englishTest: student.englishTest,
  };

  const shortlist = recommendations.map((program) => ({
    programTitle: program.title,
    universityName: program.universityName,
    country: program.country,
    city: program.city,
    field: program.field,
    degreeLevel: program.degreeLevel,
    tuitionFeeUsd: program.tuitionFeeUsd,
    durationMonths: program.durationMonths,
    minimumIelts: program.minimumIelts,
    intakes: program.intakes,
    scholarshipAvailable: program.scholarshipAvailable,
    matchScore: program.matchScore,
    matchReasons: program.reasons,
  }));

  return `Student profile:\n${JSON.stringify(
    profile
  )}\n\nDatabase-ranked shortlist (matchScore is out of 100):\n${JSON.stringify(
    shortlist
  )}`;
}

function buildFallbackPlan(student, recommendations) {
  const studentIelts = student.englishTest?.score || 0;
  const budget = student.maxBudgetUsd || 0;
  const intake = student.preferredIntake || "the next available intake";

  const categorise = (program) => {
    if (program.matchScore >= 85) return "safe";
    if (program.matchScore >= 60) return "balanced";
    return "ambitious";
  };

  const overBudget = recommendations.filter(
    (program) => budget > 0 && program.tuitionFeeUsd > budget
  );
  const ieltsGaps = recommendations.filter(
    (program) => (program.minimumIelts || 0) > studentIelts
  );

  return {
    summary: `Based on ${recommendations.length} database-ranked programs across ${
      (student.targetCountries || []).join(", ") || "your target destinations"
    }, your profile aligns most closely with ${
      recommendations[0]?.field || "your chosen field"
    }. Your strongest match is ${
      recommendations[0]?.title || "the top shortlisted program"
    } at ${recommendations[0]?.universityName || "the top shortlisted university"}.`,
    shortlistStrategy: recommendations.map((program) => ({
      programTitle: program.title,
      universityName: program.universityName,
      category: categorise(program),
      rationale: (program.reasons || []).join("; ") || "Ranked by overall profile fit.",
    })),
    timeline: [
      {
        phase: "Months 1-2",
        focus: "Lock the shortlist and close test gaps",
        actions: [
          "Confirm the final 4-6 program shortlist from the ranked recommendations.",
          ieltsGaps.length > 0
            ? `Re-sit or improve your English test: ${ieltsGaps.length} shortlisted program(s) require a higher score than your current ${studentIelts}.`
            : "Keep your English test certificate valid through the application window.",
          "Request official transcripts and academic references.",
        ],
      },
      {
        phase: "Months 3-4",
        focus: "Build the application package",
        actions: [
          "Draft one statement of purpose per country, tailored to each program's field.",
          "Secure two academic or professional letters of recommendation.",
          "Collect proof of funds documentation ahead of visa filing.",
        ],
      },
      {
        phase: "Months 5-6",
        focus: `Submit for the ${intake} intake`,
        actions: [
          "Submit applications in order of deadline, earliest first.",
          "Apply for every scholarship attached to your shortlisted programs.",
          "Track each submission's status and respond to document requests promptly.",
        ],
      },
      {
        phase: "Months 7-9",
        focus: "Offers, visa and departure",
        actions: [
          "Compare offers on total cost, not tuition alone.",
          "Accept and pay the deposit, then begin visa processing immediately.",
          "Arrange accommodation, insurance and travel once the visa is granted.",
        ],
      },
    ],
    testPreparation: {
      currentStanding:
        studentIelts > 0
          ? `Your recorded ${
              student.englishTest?.exam || "IELTS"
            } score is ${studentIelts}, which satisfies ${
              recommendations.length - ieltsGaps.length
            } of ${recommendations.length} shortlisted programs.`
          : "No English test score is recorded on your profile yet.",
      recommendations:
        ieltsGaps.length > 0
          ? [
              `Target a score of at least ${Math.max(
                ...ieltsGaps.map((program) => program.minimumIelts || 0)
              )} to unlock every shortlisted program.`,
              "Book the test at least 8 weeks before your earliest application deadline.",
            ]
          : [
              "Your current score clears all shortlisted programs; no re-sit required.",
              "Verify the certificate will still be valid on each application's deadline.",
            ],
    },
    budgetAdvice: [
      budget > 0
        ? `Your stated budget is $${budget.toLocaleString()} USD; ${
            recommendations.length - overBudget.length
          } of ${recommendations.length} shortlisted programs fall within it.`
        : "Add a budget to your profile to sharpen affordability filtering.",
      overBudget.length > 0
        ? `${overBudget.length} shortlisted program(s) exceed your budget — treat those as scholarship-dependent.`
        : "Prioritise the shortlisted programs that also offer scholarships.",
      "Budget for living costs, visa fees and health insurance on top of tuition.",
    ],
    risks: [
      "Intake deadlines close months before the start date; late submissions roll to the next cycle.",
      ieltsGaps.length > 0
        ? "An insufficient English score is currently your highest-impact blocker."
        : "Document delays (transcripts, references) are the most common source of slippage.",
      "Visa processing times vary by country — file as soon as you accept an offer.",
    ],
  };
}

async function callGroq(student, recommendations) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.groqApiKey}`,
      },
      body: JSON.stringify({
        model: env.groqModel,
        temperature: 0.4,
        max_tokens: 2048,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: buildUserPrompt(student, recommendations),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Groq request failed with status ${response.status}: ${body.slice(0, 200)}`
      );
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Groq response contained no message content.");
    }

    return JSON.parse(content);
  } finally {
    clearTimeout(timeout);
  }
}

async function buildStudyPlan(studentId, { refresh = false } = {}) {
  const cacheKey = `ai-study-plan:${studentId}`;

  if (!refresh) {
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        meta: { ...cached.meta, cache: "hit" },
      };
    }
  }

  const { data } = await buildProgramRecommendations(studentId);
  const { student, recommendations } = data;

  if (!recommendations.length) {
    throw new HttpError(
      422,
      "No programs match this student's preferences yet, so a study plan cannot be generated. Update the profile preferences and try again."
    );
  }

  let plan;
  let generator;
  let degradedReason;

  if (env.groqApiKey) {
    const startedAt = Date.now();

    try {
      plan = await callGroq(student, recommendations);
      generator = `groq:${env.groqModel}`;

      logger.info("Study plan generated by AI provider", {
        studentId: String(studentId),
        model: env.groqModel,
        durationMs: Date.now() - startedAt,
        shortlistSize: recommendations.length,
      });
    } catch (error) {
      plan = buildFallbackPlan(student, recommendations);
      generator = "rule-based-fallback";
      degradedReason =
        error.name === "AbortError"
          ? "AI provider timed out; served deterministic plan instead."
          : `AI provider unavailable (${error.message}); served deterministic plan instead.`;

      logger.warn("AI provider failed, served fallback study plan", {
        studentId: String(studentId),
        model: env.groqModel,
        durationMs: Date.now() - startedAt,
        reason: error.message,
      });
    }
  } else {
    plan = buildFallbackPlan(student, recommendations);
    generator = "rule-based-fallback";
    degradedReason =
      "GROQ_API_KEY is not configured; served deterministic plan instead.";
  }

  const payload = {
    data: {
      student,
      groundedShortlist: recommendations.map((program) => ({
        id: program._id,
        title: program.title,
        universityName: program.universityName,
        country: program.country,
        tuitionFeeUsd: program.tuitionFeeUsd,
        matchScore: program.matchScore,
      })),
      studyPlan: plan,
    },
    meta: {
      generator,
      groundedOn: "mongodb-aggregation-pipeline",
      shortlistSize: recommendations.length,
      cache: "miss",
      ...(degradedReason ? { degradedReason } : {}),
    },
  };

  cacheService.set(cacheKey, payload);

  return payload;
}

module.exports = {
  buildFallbackPlan,
  buildStudyPlan,
};

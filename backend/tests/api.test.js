const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const connectDatabase = require("../src/config/database");
const Student = require("../src/models/Student");
const Program = require("../src/models/Program");
const Application = require("../src/models/Application");

let studentToken;
let counselorToken;
let testStudentId;
let testProgram;

beforeAll(async () => {
  await connectDatabase();

  // Find seeded test student & counselor
  const student = await Student.findOne({ email: "aarav@example.com" });
  testStudentId = student._id.toString();

  // Login as student
  const studentLoginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "aarav@example.com", password: "Candidate123!" });
  studentToken = studentLoginRes.body.data.token;

  // Login as counselor
  const counselorLoginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "counselor@example.com", password: "Candidate123!" });
  counselorToken = counselorLoginRes.body.data.token;

  testProgram = await Program.findOne({ country: "Canada" });
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe("Authentication & Security APIs", () => {
  const uniqueEmail = `testuser_${Date.now()}@example.com`;

  it("should register a new student successfully", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Test Candidate",
        email: uniqueEmail,
        password: "SecurePassword123!",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(uniqueEmail);
    expect(res.body.data.role).toBe("student");
    expect(res.body.data.password).toBeUndefined();
  });

  it("edge case: should reject duplicate email with 409 Conflict", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Duplicate Candidate",
        email: uniqueEmail,
        password: "SecurePassword123!",
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("edge case: should reject registration with password shorter than 8 chars", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Short Password",
        email: `short_${Date.now()}@example.com`,
        password: "short",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should log in with valid credentials and return JWT", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "aarav@example.com",
        password: "Candidate123!",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe("aarav@example.com");
  });

  it("edge case: should reject login with invalid password with 401 Unauthorized", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "aarav@example.com",
        password: "WrongPassword!",
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("should return the current user profile on GET /api/auth/me", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe("aarav@example.com");
  });

  it("edge case: should reject GET /api/auth/me without token with 401 Unauthorized", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe("Discovery & Caching APIs", () => {
  it("should list universities with pagination metadata", async () => {
    const res = await request(app)
      .get("/api/universities?page=1&limit=3");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(3);
    expect(res.body.meta.total).toBeGreaterThan(0);
  });

  it("should filter universities by country", async () => {
    const res = await request(app)
      .get("/api/universities?country=Canada");

    expect(res.status).toBe(200);
    expect(res.body.data.every((u) => u.country.toLowerCase() === "canada")).toBe(true);
  });

  it("should filter programs by country and max budget", async () => {
    const res = await request(app)
      .get("/api/programs?country=Canada&maxBudget=22000");

    expect(res.status).toBe(200);
    expect(
      res.body.data.every(
        (p) => p.country.toLowerCase() === "canada" && p.tuitionFeeUsd <= 22000
      )
    ).toBe(true);
  });

  it("should serve cached responses on popular universities", async () => {
    // First call (populates or accesses cache)
    const res1 = await request(app).get("/api/universities/popular");
    expect(res1.status).toBe(200);

    // Second call should report cache hit
    const res2 = await request(app).get("/api/universities/popular");
    expect(res2.status).toBe(200);
    expect(res2.body.meta.cache).toBe("hit");
  });
});

describe("Recommendation Engine (MongoDB Aggregation Pipeline)", () => {
  it("should return top scored program recommendations with reasons for student", async () => {
    const res = await request(app)
      .get(`/api/recommendations/${testStudentId}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.engine).toBe("mongodb-aggregation-pipeline");
    expect(res.body.data.recommendations.length).toBeGreaterThan(0);

    const topRec = res.body.data.recommendations[0];
    expect(topRec.matchScore).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(topRec.reasons)).toBe(true);
    expect(topRec.reasons.length).toBeGreaterThan(0);
  });

  it("edge case: should return 400 for invalid student ID format", async () => {
    const res = await request(app).get("/api/recommendations/invalid-id-format");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("edge case: should return 404 for non-existent student ID", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/recommendations/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("Security Hardening", () => {
  it("should send helmet security headers on API responses", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    // helmet removes the framework fingerprint header.
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("should neutralise MongoDB operator injection in login payloads", async () => {
    // Without sanitisation, `$ne: null` would match the first student document
    // and allow an authentication bypass.
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: { $ne: null }, password: { $ne: null } });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.data?.token).toBeUndefined();
  });
});

describe("AI Study Planner (bonus)", () => {
  it("edge case: should reject unauthenticated study-plan requests with 401", async () => {
    const res = await request(app).get(
      `/api/ai/study-plan/${testStudentId}`
    );

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("edge case: should forbid a student from reading another student's plan with 403", async () => {
    const otherStudent = await Student.findOne({ email: "sara@example.com" });

    const res = await request(app)
      .get(`/api/ai/study-plan/${otherStudent._id.toString()}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("should build a deterministic fallback plan grounded on the aggregation shortlist", async () => {
    const {
      buildFallbackPlan,
    } = require("../src/services/aiStudyPlanService");
    const {
      buildProgramRecommendations,
    } = require("../src/services/recommendationService");

    const { data } = await buildProgramRecommendations(testStudentId);
    const plan = buildFallbackPlan(data.student, data.recommendations);

    expect(typeof plan.summary).toBe("string");
    expect(plan.timeline.length).toBeGreaterThan(0);
    expect(plan.shortlistStrategy.length).toBe(data.recommendations.length);
    expect(plan.risks.length).toBeGreaterThan(0);

    // The planner must never introduce a program outside the ranked shortlist.
    const shortlistTitles = data.recommendations.map((p) => p.title);
    expect(
      plan.shortlistStrategy.every((item) =>
        shortlistTitles.includes(item.programTitle)
      )
    ).toBe(true);
  });

  it("should return a study plan for the authenticated student", async () => {
    const res = await request(app)
      .get(`/api/ai/study-plan/${testStudentId}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.groundedOn).toBe("mongodb-aggregation-pipeline");
    expect(res.body.meta.generator).toBeDefined();
    expect(res.body.data.groundedShortlist.length).toBeGreaterThan(0);
    expect(res.body.data.studyPlan.summary).toBeDefined();
    expect(Array.isArray(res.body.data.studyPlan.timeline)).toBe(true);
  }, 30000);

  it("should serve the second study-plan request from cache", async () => {
    const res = await request(app)
      .get(`/api/ai/study-plan/${testStudentId}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.cache).toBe("hit");
  });
});

describe("Application Workflow & State Machine", () => {
  let createdAppId;
  const uniqueIntake = `TestIntake_${Date.now()}`;

  it("should allow authenticated student to apply to a program", async () => {
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        programId: testProgram._id.toString(),
        intake: uniqueIntake,
        note: "Initial test submission.",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("submitted");
    expect(res.body.data.timeline.length).toBe(1);

    createdAppId = res.body.data._id;
  });

  it("edge case: should reject duplicate application for same student, program, and intake with 409", async () => {
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        programId: testProgram._id.toString(),
        intake: uniqueIntake,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("edge case: should forbid student from updating application status with 403", async () => {
    const res = await request(app)
      .patch(`/api/applications/${createdAppId}/status`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ status: "under-review" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("edge case: should reject invalid status transition with 400 Bad Request", async () => {
    // Current status is 'submitted'. Permitted transitions: ['under-review', 'rejected']. Transitioning to 'enrolled' is invalid.
    const res = await request(app)
      .patch(`/api/applications/${createdAppId}/status`)
      .set("Authorization", `Bearer ${counselorToken}`)
      .send({ status: "enrolled" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Cannot transition");
  });

  it("should allow counselor to make a valid status transition and record timeline entry", async () => {
    const res = await request(app)
      .patch(`/api/applications/${createdAppId}/status`)
      .set("Authorization", `Bearer ${counselorToken}`)
      .send({
        status: "under-review",
        note: "Academic credentials verified by counselor.",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("under-review");
    expect(res.body.data.timeline.length).toBe(2);
    expect(res.body.data.timeline[1].status).toBe("under-review");
  });
});

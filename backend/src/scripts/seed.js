const connectDatabase = require("../config/database");
const logger = require("../config/logger");
const seedData = require("../data/seedData");
const {
  applicationRepository,
  programRepository,
  studentRepository,
  universityRepository,
} = require("../repositories");

async function seed() {
  await connectDatabase();

  await Promise.all([
    applicationRepository.deleteAll(),
    programRepository.deleteAll(),
    studentRepository.deleteAll(),
    universityRepository.deleteAll(),
  ]);

  const universities = await universityRepository.insertMany(
    seedData.universities
  );

  const universityByName = universities.reduce((accumulator, university) => {
    accumulator[university.name] = university;
    return accumulator;
  }, {});

  const programs = await programRepository.insertMany(
    seedData.programs.map((program) => ({
      ...program,
      university: universityByName[program.universityName]._id,
    }))
  );

  const programByTitle = programs.reduce((accumulator, program) => {
    accumulator[program.title] = program;
    return accumulator;
  }, {});

  const students = await studentRepository.createMany(seedData.students);

  const studentByEmail = students.reduce((accumulator, student) => {
    accumulator[student.email] = student;
    return accumulator;
  }, {});

  const applications = seedData.applications.map((application) => {
    const student = studentByEmail[application.studentEmail];
    const program = programByTitle[application.programTitle];
    const university = universityByName[program.universityName];

    return {
      student: student._id,
      program: program._id,
      university: university._id,
      destinationCountry: program.country,
      intake: application.intake,
      status: application.status,
      timeline: application.timeline,
    };
  });

  await applicationRepository.insertMany(applications);

  logger.info("Seed completed successfully", {
    universities: universities.length,
    programs: programs.length,
    students: students.length,
    applications: applications.length,
  });

  process.exit(0);
}

seed().catch((error) => {
  logger.error("Seed failed", { error });
  process.exit(1);
});

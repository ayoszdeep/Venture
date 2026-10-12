const app = require("./app");
const connectDatabase = require("./config/database");
const env = require("./config/env");
const logger = require("./config/logger");

async function startServer() {
  await connectDatabase();

  app.listen(env.port, () => {
    logger.info("Waygood evaluation API started", {
      port: env.port,
      env: env.nodeEnv,
    });
  });
}

startServer().catch((error) => {
  logger.error("Failed to start server", { error });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
});

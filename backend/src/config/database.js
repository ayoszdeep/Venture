const dns = require("dns");
const mongoose = require("mongoose");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const env = require("./env");
const logger = require("./logger");

async function connectDatabase() {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });

  mongoose.connection.on("error", (error) => {
    logger.error("MongoDB connection error", { error });
  });

  await mongoose.connect(env.mongoUri);
  logger.info("Connected to MongoDB");
}

module.exports = connectDatabase;

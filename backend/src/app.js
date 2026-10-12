const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");

const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");
const requestLogger = require("./middleware/requestLogger");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();

const isTestEnvironment = process.env.NODE_ENV === "test";

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors());

app.use(express.json({ limit: "100kb" }));

app.use(mongoSanitize());

if (!isTestEnvironment) {
  app.use(requestLogger);
  app.use("/api", apiLimiter);
}

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

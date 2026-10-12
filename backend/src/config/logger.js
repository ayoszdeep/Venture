const winston = require("winston");

const env = require("./env");

const { combine, colorize, errors, json, printf, timestamp } = winston.format;

const developmentFormat = combine(
  colorize({ level: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: time, stack, ...meta }) => {
    const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${time} ${level} ${stack || message}${extras}`;
  })
);

const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logger = winston.createLogger({
  level: env.logLevel,
  silent: env.nodeEnv === "test",
  format: env.nodeEnv === "production" ? productionFormat : developmentFormat,
  defaultMeta: { service: "waygood-api" },
  transports: [new winston.transports.Console()],
});

module.exports = logger;

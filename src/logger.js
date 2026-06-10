import { createLogger, format, transports } from "winston";
import chalk from "chalk";

const levelColors = {
  INFO: chalk.cyan,
  WARN: chalk.yellow,
  ERROR: chalk.red,
};

export const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      const upper = level.toUpperCase();
      const colorize = levelColors[upper] || chalk.white;
      return `${chalk.gray(`[${timestamp}]`)} ${colorize(upper)}: ${message}`;
    }),
  ),
  transports: [new transports.Console()],
});

export function log(event, data = {}) {
  console.log(
    JSON.stringify({
      event,
      at: new Date().toISOString(),
      ...data,
    }),
  );
}

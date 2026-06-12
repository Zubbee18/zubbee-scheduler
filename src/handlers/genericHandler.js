import { logger } from "../logger.js";

export async function genericHandler(type, payload) {
  if (!type) throw new Error("Job type is required");

  // Simulate processing delay
  const delay = 50 + Math.floor(Math.random() * 150);
  await new Promise((r) => setTimeout(r, delay));

  // Simulate occasional transient failure (20% chance)
  if (Math.random() < 0.2) {
    throw new Error(`Transient failure processing job type "${type}"`);
  }

  logger.info(`genericHandler: processed job type="${type}"`);
  return {
    processed: true,
    type,
    payload,
    processedAt: new Date().toISOString(),
  };
}

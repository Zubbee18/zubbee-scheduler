import { log } from "../logger.js";

export async function emailHandler(payload) {
  const { to, subject, body } = payload;

  // Real validation logic
  if (!to || !to.includes("@")) throw new Error("Invalid email address");
  if (!subject) throw new Error("Subject is required");

  // Simulate occasional failures for testing
  if (Math.random() < 0.3) throw new Error("Mail server timeout");

  // Simulate sending delay
  await new Promise((r) => setTimeout(r, 100));

  log("email.sent", { to, subject });
  return { delivered: true, to, subject, sentAt: new Date().toISOString() };
}

import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

import validator from "validator";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { createRequire } from "module";
import db from "./db.js";
import { logger } from "./logger.js";
import { jobRouter } from "./routes/jobs.js";
import { dlqRouter } from "./routes/dlq.js";

const require = createRequire(import.meta.url);
const swaggerDocument = require("./swagger.json");

const app = express();

const allowedOrigins = process.env.FRONTEND_URL.split(",").map((origin) =>
  origin.trim(),
);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/jobs", jobRouter);

app.use("/dlq", dlqRouter);

app.listen(3000, () => {
  logger.info("Server running at http://localhost:3000");
  logger.info("Swagger UI available at http://localhost:3000/api-docs");
});

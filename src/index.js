import validator from "validator";
import express from "express";
import db from "./db";
import logger from "./logger";
import { jobRouter } from "./routes/jobs";
import { dlqRouter } from "./routes/dlq";

const app = express();
app.use(express.json());

app.use("/jobs", jobRouter);

app.use("/dlq", dlqRouter);

app.listen(3000, () => {
  logger.info("Server running at http://localhost:3000");
});

require("./worker");

import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

import { runWorker } from "./worker.js";

runWorker();
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { activeModel, aiConfigured } from "./services/grokService";
import { startSimulation } from "./services/telemetryService";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const envFiles = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
  path.resolve(moduleDir, "../.env"),
  path.resolve(moduleDir, "../../.env"),
];

for (const file of envFiles) {
  dotenv.config({ path: file });
}

const port = Number(process.env.PORT) || 3001;
startSimulation();
createApp().listen(port, () => {
  console.log(`Mission Control AI API listening on http://localhost:${port}`);
  console.log(`Grok: ${aiConfigured() ? "configured" : "not configured — fallback rules active"}`);
  console.log(`Model: ${activeModel()}`);
});

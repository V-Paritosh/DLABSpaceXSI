import cors from "cors";
import express from "express";
import { apiRouter, handleApiError } from "./routes/api";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", apiRouter);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (handleApiError(error, res)) return;
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    },
  );
  return app;
}

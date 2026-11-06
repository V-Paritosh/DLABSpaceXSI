import { Router, type Request, type Response, type RequestHandler } from "express";
import { isScenarioId } from "../config/scenarios";
import { state } from "../state/store";
import { HttpError, requestInvestigation } from "../services/investigationService";
import { getHistory, getMissionView, getTelemetryView, setScenario } from "../services/telemetryService";
import { activeModel, aiConfigured } from "../services/grokService";

export const apiRouter = Router();

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

apiRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: aiConfigured(),
    model: activeModel(),
  });
});

apiRouter.get("/mission", (_req, res) => {
  res.json(getMissionView());
});

apiRouter.get("/telemetry", (_req, res) => {
  const telemetry = getTelemetryView();
  if (!telemetry) {
    res.status(503).json({ error: "Telemetry is not available" });
    return;
  }
  res.json(telemetry);
});

apiRouter.get("/telemetry/history", (req, res) => {
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 60;
  res.json(getHistory(limit));
});

apiRouter.post("/scenarios/:scenarioId", (req, res) => {
  const scenarioId = req.params.scenarioId;
  if (!isScenarioId(scenarioId)) {
    res.status(400).json({
      error: "Unknown scenario. Use normal, engine-overheating, or fuel-pressure-drop.",
    });
    return;
  }
  setScenario(scenarioId);
  res.json({
    scenario: scenarioId,
    mission: getMissionView(),
    telemetry: getTelemetryView(),
  });
});

apiRouter.get("/anomalies", (_req, res) => {
  res.json(state.anomalies);
});

apiRouter.get("/anomalies/:id", (req, res) => {
  const anomaly = state.anomalies.find((item) => item.id === req.params.id);
  if (!anomaly) {
    res.status(404).json({ error: "Anomaly not found" });
    return;
  }
  res.json(anomaly);
});

apiRouter.post(
  "/anomalies/:id/investigate",
  asyncRoute(async (req, res) => {
    const investigation = await requestInvestigation(req.params.id, "manual");
    res.json(investigation);
  }),
);

apiRouter.get("/investigations", (_req, res) => {
  res.json(state.investigations);
});

export function handleApiError(error: unknown, res: Response): boolean {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

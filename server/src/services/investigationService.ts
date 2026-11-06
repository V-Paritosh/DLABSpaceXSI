import type { AnomalySignal } from "./anomalyService";
import { buildContext } from "./context";
import { requestGrokInvestigation, resetGrokLimiter } from "./grokService";
import { finalizeInvestigation } from "./report";
import { state } from "../state/store";
import type { Anomaly, Investigation, Telemetry } from "../types";

const inflight = new Set<string>();
const rerun = new Set<string>();

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function resetInvestigationLocks(): void {
  inflight.clear();
  rerun.clear();
  resetGrokLimiter();
}

async function produce(anomaly: Anomaly, sample: Telemetry, history: Telemetry[]): Promise<Investigation> {
  const outcome = await requestGrokInvestigation(buildContext(anomaly, sample, history));
  return finalizeInvestigation(anomaly, sample, history, outcome);
}

export function noteEscalation(anomalyId: string): void {
  if (!state.autoInvestigate) return;
  if (inflight.has(anomalyId)) {
    rerun.add(anomalyId);
    return;
  }
  void requestInvestigation(anomalyId, "auto").catch((error: unknown) => {
    console.error("[investigate] escalation follow-up failed", error);
  });
}

export function dispatchAnomalySignals(signals: AnomalySignal[]): void {
  if (!state.autoInvestigate) return;
  for (const signal of signals) {
    if (signal.type === "escalated") {
      noteEscalation(signal.anomalyId);
      continue;
    }
    void requestInvestigation(signal.anomalyId, "auto").catch((error: unknown) => {
      console.error("[investigate] automatic start failed", error);
    });
  }
}

export async function requestInvestigation(anomalyId: string, origin: "auto" | "manual"): Promise<Investigation> {
  const anomaly = state.anomalies.find((item) => item.id === anomalyId);
  if (!anomaly) {
    throw new HttpError(404, "Anomaly not found");
  }
  if (inflight.has(anomalyId)) {
    if (origin === "auto") {
      rerun.add(anomalyId);
    }
    throw new HttpError(409, "Investigation already in progress");
  }
  if (!state.current) {
    throw new HttpError(503, "Telemetry is not available");
  }

  const sample: Telemetry = { ...state.current };
  const history = state.history.slice(-15).map((point) => ({ ...point }));
  inflight.add(anomalyId);
  if (anomaly.status !== "RESOLVED") {
    anomaly.status = "INVESTIGATING";
  }

  const started = Date.now();
  try {
    const record = await produce(anomaly, sample, history);
    if (anomaly.status === "INVESTIGATING") {
      anomaly.status = "INVESTIGATED";
    }
    console.log(`[investigate] ${record.id} ${anomaly.id} ${origin} ${record.source} ${Date.now() - started}ms`);
    return record;
  } finally {
    inflight.delete(anomalyId);
    if (rerun.delete(anomalyId)) {
      const latest = state.anomalies.find((item) => item.id === anomalyId);
      if (latest && latest.status !== "RESOLVED") {
        void requestInvestigation(anomalyId, "auto").catch((error: unknown) => {
          console.error("[investigate] queued rerun failed", error);
        });
      }
    }
  }
}

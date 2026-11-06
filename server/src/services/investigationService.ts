import { CHANNELS, evaluateChannel } from "../config/channels";
import { nextInvestigationId, state } from "../state/store";
import type { Anomaly, Investigation, ParsedInvestigation, Telemetry } from "../types";
import { round } from "../utils/number";
import { buildFallbackInvestigation } from "./fallbackService";
import { requestGrokInvestigation, resetGrokLimiter } from "./grokService";

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

function stats(history: Telemetry[], key: keyof Telemetry) {
  const values = history.map((point) => point[key]).filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  const first = values[0];
  const last = values[values.length - 1];
  return {
    first,
    last,
    min: Math.min(...values),
    max: Math.max(...values),
    delta: round(last - first, 3),
  };
}

function buildContext(anomaly: Anomaly, sample: Telemetry, history: Telemetry[]) {
  return {
    mission: {
      id: state.mission.id,
      name: state.mission.name,
      status: state.mission.status,
      scenario: state.scenario,
    },
    anomaly,
    current: sample,
    channels: CHANNELS.map((channel) => ({
      key: channel.key,
      label: channel.label,
      subsystem: channel.subsystem,
      unit: channel.unit,
      value: sample[channel.key],
      status: evaluateChannel(channel, sample[channel.key]),
      direction: channel.direction,
      warning: channel.warning,
      critical: channel.critical,
    })),
    history,
    computed_from_supplied_history: {
      engineTemperature: stats(history, "engineTemperature"),
      fuelPressure: stats(history, "fuelPressure"),
      batteryVoltage: stats(history, "batteryVoltage"),
      vibration: stats(history, "vibration"),
      fuelRemaining: stats(history, "fuelRemaining"),
    },
    constraints: [
      "Simulated telemetry only.",
      "Do not invent readings that are absent from current, history, or computed_from_supplied_history.",
      "Recommendations are for a human operator and are not vehicle commands.",
    ],
  };
}

function toRecord(
  anomaly: Anomaly,
  parsed: ParsedInvestigation,
  source: Investigation["source"],
  notice: string | null,
  model: string | null,
): Investigation {
  return {
    id: nextInvestigationId(),
    anomalyId: anomaly.id,
    summary: parsed.anomaly_summary,
    affectedSubsystem: parsed.affected_subsystem || anomaly.subsystem,
    observations: parsed.observations,
    potentialCauses: [...parsed.potential_causes].sort((a, b) => b.confidence - a.confidence),
    recommendedActions: parsed.recommended_actions,
    evidence: parsed.evidence,
    createdAt: new Date().toISOString(),
    source,
    notice,
    model,
  };
}

async function produce(
  anomaly: Anomaly,
  sample: Telemetry,
  history: Telemetry[],
): Promise<Investigation> {
  const fallback = () => buildFallbackInvestigation(anomaly, sample, history);
  const outcome = await requestGrokInvestigation(buildContext(anomaly, sample, history));
  if (outcome.ok) {
    if (outcome.data.severity && outcome.data.severity !== anomaly.severity) {
      outcome.data.anomaly_summary = `${outcome.data.anomaly_summary} Live alarm severity from the threshold engine is ${anomaly.severity}.`;
    }
    return toRecord(anomaly, outcome.data, "grok", null, outcome.model);
  }

  return toRecord(anomaly, fallback(), "fallback", outcome.reason, null);
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

export async function requestInvestigation(
  anomalyId: string,
  origin: "auto" | "manual",
): Promise<Investigation> {
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
    state.investigations.unshift(record);
    if (state.investigations.length > 100) {
      state.investigations.length = 100;
    }
    if (anomaly.status === "INVESTIGATING") {
      anomaly.status = "INVESTIGATED";
    }
    console.log(
      `[investigate] ${record.id} ${anomaly.id} ${origin} ${record.source} ${Date.now() - started}ms`,
    );
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

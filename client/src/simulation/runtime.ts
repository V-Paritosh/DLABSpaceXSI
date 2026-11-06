import { requestRemoteInvestigation } from "../services/api";
import { applyScenario, getHistory, getMissionCore, getTelemetryView, seedHistory, stepSimulation } from "../../../server/src/simulation/engine";
import type { AnomalySignal } from "../../../server/src/services/anomalyService";
import { buildContext } from "../../../server/src/services/context";
import { finalizeInvestigation } from "../../../server/src/services/report";
import { state } from "../../../server/src/state/store";
import type { ScenarioId } from "../../../server/src/types";
import type { DashboardData, Investigation } from "../types";

const listeners = new Set<() => void>();
const inflight = new Set<string>();
const rerun = new Set<string>();

let timer: ReturnType<typeof setInterval> | null = null;
let started = false;
let loopRunning = false;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function readDashboard(ai: { aiConfigured: boolean; aiModel: string }): DashboardData | null {
  const telemetry = getTelemetryView();
  if (!telemetry) return null;
  const mission = getMissionCore();
  return {
    mission: {
      ...mission,
      simulationActive: mission.simulationActive && loopRunning,
      aiConfigured: ai.aiConfigured,
      aiModel: ai.aiModel,
    },
    telemetry,
    history: getHistory(60),
    anomalies: state.anomalies.map((anomaly) => ({ ...anomaly })),
    investigations: state.investigations.map((investigation) => ({
      ...investigation,
      observations: [...investigation.observations],
      potentialCauses: investigation.potentialCauses.map((cause) => ({ ...cause })),
      recommendedActions: [...investigation.recommendedActions],
      evidence: [...investigation.evidence],
    })),
  };
}

function armLoop(): void {
  if (timer !== null) window.clearInterval(timer);
  timer = window.setInterval(() => {
    const stepped = stepSimulation();
    emit();
    handleSignals(stepped.signals);
  }, 1000);
}

function handleSignals(signals: AnomalySignal[]): void {
  for (const signal of signals) {
    if (signal.type === "escalated" && inflight.has(signal.anomalyId)) {
      rerun.add(signal.anomalyId);
      continue;
    }
    void runInvestigation(signal.anomalyId, "auto").catch((error: unknown) => {
      console.error("[investigate] automatic start failed", error);
    });
  }
}

export function startMissionLoop(): () => void {
  if (!started) {
    if (state.history.length === 0) seedHistory();
    const stepped = stepSimulation();
    started = true;
    loopRunning = true;
    queueMicrotask(() => {
      emit();
      handleSignals(stepped.signals);
    });
  } else {
    loopRunning = true;
    queueMicrotask(emit);
  }

  armLoop();

  return () => {
    loopRunning = false;
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

export function selectScenario(scenario: ScenarioId): void {
  const stepped = applyScenario(scenario);
  if (loopRunning) armLoop();
  emit();
  handleSignals(stepped.signals);
  console.info(`[scenario] ${scenario}`);
}

export async function runInvestigation(anomalyId: string, origin: "auto" | "manual"): Promise<Investigation> {
  const anomaly = state.anomalies.find((item) => item.id === anomalyId);
  if (!anomaly) throw new Error("Anomaly not found");
  if (inflight.has(anomalyId)) {
    if (origin === "auto") rerun.add(anomalyId);
    throw new Error("Investigation already in progress");
  }
  if (!state.current) throw new Error("Telemetry is not available");

  const sample = { ...state.current };
  const history = state.history.slice(-15).map((point) => ({ ...point }));
  inflight.add(anomalyId);
  if (anomaly.status !== "RESOLVED") anomaly.status = "INVESTIGATING";
  emit();

  const startedAt = Date.now();
  try {
    const outcome = await requestRemoteInvestigation(buildContext(anomaly, sample, history));
    const record = finalizeInvestigation(anomaly, sample, history, outcome);
    if (anomaly.status === "INVESTIGATING") anomaly.status = "INVESTIGATED";
    console.info(`[investigate] ${record.id} ${anomaly.id} ${origin} ${record.source} ${Date.now() - startedAt}ms`);
    emit();
    return record;
  } finally {
    inflight.delete(anomalyId);
    if (rerun.delete(anomalyId)) {
      const latest = state.anomalies.find((item) => item.id === anomalyId);
      if (latest && latest.status !== "RESOLVED") {
        void runInvestigation(anomalyId, "auto").catch((error: unknown) => {
          console.error("[investigate] queued rerun failed", error);
        });
      }
    }
  }
}

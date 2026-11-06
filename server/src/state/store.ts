import type { Anomaly, Investigation, Mission, ScenarioId, Telemetry } from "../types";

export interface AppState {
  mission: Mission;
  scenario: ScenarioId;
  scenarioTick: number;
  tick: number;
  fuelRemaining: number;
  current: Telemetry | null;
  history: Telemetry[];
  anomalies: Anomaly[];
  investigations: Investigation[];
  anomalySeq: number;
  investigationSeq: number;
  autoInvestigate: boolean;
}

const MISSION_ID = "orbital-01";

function createMission(): Mission {
  return {
    id: MISSION_ID,
    name: "ORBITAL-01",
    status: "NOMINAL",
    simulationActive: true,
    createdAt: new Date().toISOString(),
  };
}

export function createInitialState(): AppState {
  return {
    mission: createMission(),
    scenario: "normal",
    scenarioTick: 0,
    tick: 0,
    fuelRemaining: 77.5,
    current: null,
    history: [],
    anomalies: [],
    investigations: [],
    anomalySeq: 0,
    investigationSeq: 0,
    autoInvestigate: true,
  };
}

export const state: AppState = createInitialState();

export function resetState(): void {
  const fresh = createInitialState();
  state.mission = fresh.mission;
  state.scenario = fresh.scenario;
  state.scenarioTick = fresh.scenarioTick;
  state.tick = fresh.tick;
  state.fuelRemaining = fresh.fuelRemaining;
  state.current = fresh.current;
  state.history = fresh.history;
  state.anomalies = fresh.anomalies;
  state.investigations = fresh.investigations;
  state.anomalySeq = fresh.anomalySeq;
  state.investigationSeq = fresh.investigationSeq;
  state.autoInvestigate = fresh.autoInvestigate;
}

export function nextAnomalyId(): string {
  state.anomalySeq += 1;
  return `ANM-${String(state.anomalySeq).padStart(4, "0")}`;
}

export function nextInvestigationId(): string {
  state.investigationSeq += 1;
  return `INV-${String(state.investigationSeq).padStart(4, "0")}`;
}

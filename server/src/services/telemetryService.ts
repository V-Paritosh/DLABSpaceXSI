import { state } from "../state/store";
import type { ScenarioId, Telemetry } from "../types";
import { applyScenario, seedHistory, stepSimulation } from "../simulation/engine";
import { dispatchAnomalySignals } from "./investigationService";

export { getHistory, getTelemetryView } from "../simulation/engine";
export type { ChannelSnapshot } from "../simulation/engine";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function advanceSimulation(timestamp = new Date().toISOString()): Telemetry {
  const stepped = stepSimulation(timestamp);
  dispatchAnomalySignals(stepped.signals);
  return stepped.sample;
}

function schedule(): void {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    advanceSimulation();
  }, 1000);
}

export function startSimulation(): void {
  if (running) return;
  running = true;
  if (state.history.length === 0) seedHistory();
  advanceSimulation();
  schedule();
}

export function stopSimulation(): void {
  running = false;
  if (timer) clearInterval(timer);
  timer = null;
}

export function setScenario(scenario: ScenarioId): Telemetry {
  const stepped = applyScenario(scenario);
  dispatchAnomalySignals(stepped.signals);
  if (running) schedule();
  console.log(`[scenario] ${scenario}`);
  return stepped.sample;
}

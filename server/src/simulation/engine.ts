import { CHANNELS, evaluateChannel } from "../config/channels";
import { SCENARIO_LABELS } from "../config/scenarios";
import { evaluateAnomalies, type AnomalySignal } from "../services/anomalyService";
import { state } from "../state/store";
import type { ScenarioId, Telemetry } from "../types";
import { round } from "../utils/number";
import { generateTelemetry, nextFuelRemaining } from "./generator";

const HISTORY_CAP = 180;

export interface ChannelSnapshot {
  key: (typeof CHANNELS)[number]["key"];
  label: string;
  subsystem: string;
  unit: string;
  decimals: number;
  direction: (typeof CHANNELS)[number]["direction"];
  warning: number | null;
  critical: number | null;
  nominalText: string;
  chart: boolean;
  chartMin: number;
  chartMax: number;
  value: number;
  status: "NOMINAL" | "WARNING" | "CRITICAL";
  trend: number | null;
}

export interface SimulationStep {
  sample: Telemetry;
  signals: AnomalySignal[];
}

function trendFor(current: Telemetry, key: keyof Telemetry, decimals: number): number | null {
  const past = state.history[state.history.length - 11];
  if (!past) return null;
  const previous = past[key];
  const latest = current[key];
  if (typeof previous !== "number" || typeof latest !== "number") return null;
  return round(latest - previous, decimals);
}

export function channelSnapshots(current: Telemetry): ChannelSnapshot[] {
  return CHANNELS.map((channel) => ({
    key: channel.key,
    label: channel.label,
    subsystem: channel.subsystem,
    unit: channel.unit,
    decimals: channel.decimals,
    direction: channel.direction,
    warning: channel.warning,
    critical: channel.critical,
    nominalText: channel.nominalText,
    chart: channel.chart,
    chartMin: channel.chartMin,
    chartMax: channel.chartMax,
    value: current[channel.key],
    status: evaluateChannel(channel, current[channel.key]),
    trend: trendFor(current, channel.key, channel.decimals),
  }));
}

export function stepSimulation(timestamp = new Date().toISOString()): SimulationStep {
  state.fuelRemaining = nextFuelRemaining(state.fuelRemaining, state.scenario);
  const sample = generateTelemetry({
    tick: state.tick,
    scenario: state.scenario,
    scenarioTick: state.scenarioTick,
    fuelRemaining: state.fuelRemaining,
    timestamp,
  });
  state.current = sample;
  state.history.push(sample);
  if (state.history.length > HISTORY_CAP) {
    state.history.splice(0, state.history.length - HISTORY_CAP);
  }
  const signals = evaluateAnomalies(sample);
  state.tick += 1;
  state.scenarioTick += 1;
  return { sample, signals };
}

export function seedHistory(): void {
  const now = Date.now();
  const samples = 59;
  for (let age = samples; age >= 1; age -= 1) {
    state.fuelRemaining = nextFuelRemaining(state.fuelRemaining, "normal");
    const sample = generateTelemetry({
      tick: state.tick,
      scenario: "normal",
      scenarioTick: 0,
      fuelRemaining: state.fuelRemaining,
      timestamp: new Date(now - age * 1000).toISOString(),
    });
    state.history.push(sample);
    state.tick += 1;
  }
}

export function applyScenario(scenario: ScenarioId, timestamp = new Date().toISOString()): SimulationStep {
  state.scenario = scenario;
  state.scenarioTick = 0;
  return stepSimulation(timestamp);
}

export function getMissionCore() {
  return {
    id: state.mission.id,
    name: state.mission.name,
    status: state.mission.status,
    simulationActive: state.mission.simulationActive,
    scenario: state.scenario,
    scenarioLabel: SCENARIO_LABELS[state.scenario],
    createdAt: state.mission.createdAt,
    timestamp: state.current?.timestamp ?? new Date().toISOString(),
  };
}

export function getTelemetryView() {
  if (!state.current) return null;
  return {
    current: state.current,
    channels: channelSnapshots(state.current),
    scenario: state.scenario,
  };
}

export function getHistory(limit: number) {
  const safeLimit = Number.isFinite(limit) ? Math.min(180, Math.max(1, Math.floor(limit))) : 60;
  return {
    missionId: state.mission.id,
    points: state.history.slice(-safeLimit),
  };
}

import type { ScenarioId, Telemetry } from "../types";
import { round } from "../utils/number";

const MISSION_ID = "orbital-01";

function wobble(tick: number, amplitude: number, period: number, phase: number): number {
  const primary = Math.sin(((tick + phase) / period) * Math.PI * 2);
  const secondary = Math.sin(((tick + phase * 1.7) / (period * 2.6)) * Math.PI * 2);
  return amplitude * (primary * 0.8 + secondary * 0.2);
}

export function nextFuelRemaining(fuelRemaining: number, scenario: ScenarioId): number {
  const burn =
    scenario === "fuel-pressure-drop" ? 0.05 : scenario === "engine-overheating" ? 0.03 : 0.015;
  return round(Math.max(18, fuelRemaining - burn), 2);
}

export interface GenerateInput {
  tick: number;
  scenario: ScenarioId;
  scenarioTick: number;
  fuelRemaining: number;
  timestamp: string;
}

export function generateTelemetry(input: GenerateInput): Telemetry {
  const { tick, scenario, scenarioTick } = input;
  const noise = scenario === "normal" ? 1 : 0.35;

  const temperature = 446 + wobble(tick, 6.5 * noise, 17, 0.4);
  const pressure = 328 + wobble(tick, 5.5 * noise, 21, 2.2);
  const battery = 28.16 + wobble(tick, 0.16 * Math.max(noise, 0.7), 28, 1.1);
  let vibration = 0.128 + Math.abs(wobble(tick, 0.035 * Math.max(noise, 0.5), 11, 0.6));

  let engineTemperature = temperature;
  let fuelPressure = pressure;

  if (scenario === "engine-overheating") {
    const rise = Math.min(270, scenarioTick * 22);
    engineTemperature = temperature + rise;
    vibration += Math.min(0.06, scenarioTick * 0.008);
  }

  if (scenario === "fuel-pressure-drop") {
    const drop = Math.min(185, scenarioTick * 18);
    fuelPressure = pressure - drop;
  }

  return {
    missionId: MISSION_ID,
    timestamp: input.timestamp,
    engineTemperature: round(engineTemperature, 1),
    fuelPressure: round(Math.max(110, fuelPressure), 1),
    batteryVoltage: round(battery, 2),
    vibration: round(vibration, 3),
    fuelRemaining: input.fuelRemaining,
  };
}

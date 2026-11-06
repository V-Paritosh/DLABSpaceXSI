import type { ScenarioId } from "../types";

export const SCENARIO_IDS: ScenarioId[] = ["normal", "engine-overheating", "fuel-pressure-drop"];

export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  normal: "Normal Operation",
  "engine-overheating": "Engine Overheating",
  "fuel-pressure-drop": "Fuel Pressure Drop",
};

export function isScenarioId(value: string): value is ScenarioId {
  return SCENARIO_IDS.includes(value as ScenarioId);
}

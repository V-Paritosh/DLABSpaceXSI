export type ScenarioId = "normal" | "engine-overheating" | "fuel-pressure-drop";

export type MissionStatus = "NOMINAL" | "WARNING" | "CRITICAL";

export type Severity = "WARNING" | "CRITICAL";

export type AnomalyStatus = "ACTIVE" | "INVESTIGATING" | "INVESTIGATED" | "RESOLVED";

export type ChannelKey =
  | "engineTemperature"
  | "fuelPressure"
  | "batteryVoltage"
  | "vibration"
  | "fuelRemaining";

export interface Telemetry {
  missionId: string;
  timestamp: string;
  engineTemperature: number;
  fuelPressure: number;
  batteryVoltage: number;
  vibration: number;
  fuelRemaining: number;
}

export interface ChannelSnapshot {
  key: ChannelKey;
  label: string;
  subsystem: string;
  unit: string;
  decimals: number;
  direction: "high" | "low" | "none";
  warning: number | null;
  critical: number | null;
  nominalText: string;
  chart: boolean;
  chartMin: number;
  chartMax: number;
  value: number;
  status: "NOMINAL" | Severity;
  trend: number | null;
}

export interface TelemetryResponse {
  current: Telemetry;
  channels: ChannelSnapshot[];
  scenario: ScenarioId;
}

export interface HistoryResponse {
  missionId: string;
  points: Telemetry[];
}

export interface MissionResponse {
  id: string;
  name: string;
  status: MissionStatus;
  simulationActive: boolean;
  scenario: ScenarioId;
  scenarioLabel: string;
  createdAt: string;
  timestamp: string;
  aiConfigured: boolean;
  aiModel: string;
}

export interface Anomaly {
  id: string;
  missionId: string;
  subsystem: string;
  metric: ChannelKey;
  name: string;
  observedValue: number;
  threshold: number;
  severity: Severity;
  description: string;
  timestamp: string;
  updatedAt: string;
  status: AnomalyStatus;
  unit: string;
}

export interface PotentialCause {
  description: string;
  confidence: number;
}

export interface Investigation {
  id: string;
  anomalyId: string;
  summary: string;
  affectedSubsystem: string;
  observations: string[];
  potentialCauses: PotentialCause[];
  recommendedActions: string[];
  evidence: string[];
  createdAt: string;
  source: "grok" | "fallback";
  notice: string | null;
  model: string | null;
}

export interface DashboardData {
  mission: MissionResponse;
  telemetry: TelemetryResponse;
  history: HistoryResponse;
  anomalies: Anomaly[];
  investigations: Investigation[];
}

export interface ScenarioOption {
  id: ScenarioId;
  label: string;
  detail: string;
}

export const SCENARIOS: ScenarioOption[] = [
  {
    id: "normal",
    label: "Normal Operation",
    detail: "Return every channel to its operating band and clear active alarms.",
  },
  {
    id: "engine-overheating",
    label: "Engine Overheating",
    detail: "Ramp engine temperature through the 550 K warning and 600 K critical limits.",
  },
  {
    id: "fuel-pressure-drop",
    label: "Fuel Pressure Drop",
    detail: "Decay fuel pressure through the 250 PSI warning and 200 PSI critical limits.",
  },
];

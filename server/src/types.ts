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

export interface Mission {
  id: string;
  name: string;
  status: MissionStatus;
  simulationActive: boolean;
  createdAt: string;
}

export interface ParsedInvestigation {
  anomaly_summary: string;
  affected_subsystem: string;
  severity: Severity | null;
  observations: string[];
  potential_causes: PotentialCause[];
  recommended_actions: string[];
  evidence: string[];
}

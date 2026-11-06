import type { ChannelKey, Severity } from "../types";

export type Direction = "high" | "low" | "none";
export type ChannelHealth = "NOMINAL" | Severity;

export interface ChannelDef {
  key: ChannelKey;
  label: string;
  subsystem: string;
  unit: string;
  decimals: number;
  direction: Direction;
  warning: number | null;
  critical: number | null;
  nominalText: string;
  chart: boolean;
  chartMin: number;
  chartMax: number;
  anomalyName: string;
}

export const CHANNELS: ChannelDef[] = [
  {
    key: "engineTemperature",
    label: "Engine Temperature",
    subsystem: "Propulsion",
    unit: "K",
    decimals: 1,
    direction: "high",
    warning: 550,
    critical: 600,
    nominalText: "≤ 550 K",
    chart: true,
    chartMin: 400,
    chartMax: 760,
    anomalyName: "Engine Overtemperature",
  },
  {
    key: "fuelPressure",
    label: "Fuel Pressure",
    subsystem: "Fuel",
    unit: "PSI",
    decimals: 1,
    direction: "low",
    warning: 250,
    critical: 200,
    nominalText: "≥ 250 PSI",
    chart: true,
    chartMin: 120,
    chartMax: 400,
    anomalyName: "Fuel Pressure Loss",
  },
  {
    key: "batteryVoltage",
    label: "Battery Voltage",
    subsystem: "Power",
    unit: "V",
    decimals: 2,
    direction: "low",
    warning: 24,
    critical: 20,
    nominalText: "≥ 24 V",
    chart: true,
    chartMin: 18,
    chartMax: 32,
    anomalyName: "Battery Undervoltage",
  },
  {
    key: "vibration",
    label: "Vibration",
    subsystem: "Structures",
    unit: "G",
    decimals: 3,
    direction: "high",
    warning: 0.5,
    critical: 1,
    nominalText: "≤ 0.50 G",
    chart: true,
    chartMin: 0,
    chartMax: 1.2,
    anomalyName: "Excess Vibration",
  },
  {
    key: "fuelRemaining",
    label: "Fuel Remaining",
    subsystem: "Fuel",
    unit: "%",
    decimals: 2,
    direction: "none",
    warning: null,
    critical: null,
    nominalText: "No alarm limit",
    chart: false,
    chartMin: 0,
    chartMax: 100,
    anomalyName: "Fuel Quantity",
  },
];

export const MONITORED_CHANNELS = CHANNELS.filter((channel) => channel.direction !== "none");

export function channelByKey(key: ChannelKey): ChannelDef {
  const channel = CHANNELS.find((item) => item.key === key);
  if (!channel) {
    throw new Error(`Unknown channel ${key}`);
  }
  return channel;
}

export function evaluateChannel(def: ChannelDef, value: number): ChannelHealth {
  if (def.direction === "none" || def.warning === null || def.critical === null) {
    return "NOMINAL";
  }

  if (def.direction === "high") {
    if (value > def.critical) return "CRITICAL";
    if (value > def.warning) return "WARNING";
    return "NOMINAL";
  }

  if (value < def.critical) return "CRITICAL";
  if (value < def.warning) return "WARNING";
  return "NOMINAL";
}

export function thresholdFor(def: ChannelDef, severity: Severity): number {
  const threshold = severity === "CRITICAL" ? def.critical : def.warning;
  if (threshold === null) {
    throw new Error(`No ${severity} threshold for ${def.key}`);
  }
  return threshold;
}

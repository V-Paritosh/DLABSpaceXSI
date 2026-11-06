import { CHANNELS, evaluateChannel } from "../config/channels";
import { state } from "../state/store";
import type { Anomaly, Telemetry } from "../types";
import { round } from "../utils/number";

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

export function buildContext(anomaly: Anomaly, sample: Telemetry, history: Telemetry[]) {
  return {
    mission: {
      id: state.mission.id,
      name: state.mission.name,
      status: state.mission.status,
      scenario: state.scenario,
    },
    anomaly: { ...anomaly },
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

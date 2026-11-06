import { MONITORED_CHANNELS, evaluateChannel, thresholdFor } from "../config/channels";
import { nextAnomalyId, state } from "../state/store";
import type { Anomaly, MissionStatus, Telemetry } from "../types";
import { formatReading } from "../utils/number";
import { noteEscalation, requestInvestigation } from "./investigationService";

export function calculateMissionStatus(anomalies: Anomaly[]): MissionStatus {
  const open = anomalies.filter((anomaly) => anomaly.status !== "RESOLVED");
  if (open.some((anomaly) => anomaly.severity === "CRITICAL")) return "CRITICAL";
  if (open.some((anomaly) => anomaly.severity === "WARNING")) return "WARNING";
  return "NOMINAL";
}

function describe(
  name: string,
  value: number,
  decimals: number,
  unit: string,
  direction: "high" | "low",
  severity: "WARNING" | "CRITICAL",
  threshold: number,
): string {
  const relation = direction === "high" ? "above" : "below";
  return `${name}: ${formatReading(value, decimals)} ${unit} is ${relation} the ${severity.toLowerCase()} threshold of ${threshold} ${unit}.`;
}

export function evaluateAnomalies(sample: Telemetry): void {
  for (const channel of MONITORED_CHANNELS) {
    const value = sample[channel.key];
    const health = evaluateChannel(channel, value);
    const direction = channel.direction;
    const open = state.anomalies.find(
      (anomaly) => anomaly.metric === channel.key && anomaly.status !== "RESOLVED",
    );

    if (health === "NOMINAL" || direction === "none") {
      if (open) {
        open.status = "RESOLVED";
        open.updatedAt = sample.timestamp;
      }
      continue;
    }

    const threshold = thresholdFor(channel, health);
    const description = describe(
      channel.anomalyName,
      value,
      channel.decimals,
      channel.unit,
      direction,
      health,
      threshold,
    );

    if (!open) {
      const anomaly: Anomaly = {
        id: nextAnomalyId(),
        missionId: sample.missionId,
        subsystem: channel.subsystem,
        metric: channel.key,
        name: channel.anomalyName,
        observedValue: value,
        threshold,
        severity: health,
        description,
        timestamp: sample.timestamp,
        updatedAt: sample.timestamp,
        status: "ACTIVE",
        unit: channel.unit,
      };
      state.anomalies.unshift(anomaly);
      if (state.anomalies.length > 100) {
        state.anomalies.length = 100;
      }
      if (state.autoInvestigate && health === "CRITICAL") {
        void requestInvestigation(anomaly.id, "auto").catch((error: unknown) => {
          console.error("[investigate] automatic start failed", error);
        });
      }
      continue;
    }

    const escalated = open.severity === "WARNING" && health === "CRITICAL";
    open.observedValue = value;
    open.threshold = threshold;
    open.severity = health;
    open.description = description;
    open.updatedAt = sample.timestamp;

    if (escalated && state.autoInvestigate) {
      noteEscalation(open.id);
    }
  }

  state.mission.status = calculateMissionStatus(state.anomalies);
}

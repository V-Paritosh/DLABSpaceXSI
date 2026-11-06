import { CHANNELS, channelByKey, evaluateChannel } from "../config/channels";
import type { Anomaly, ParsedInvestigation, Telemetry } from "../types";
import { formatReading, round } from "../utils/number";

interface ChannelStats {
  first: number;
  last: number;
  min: number;
  max: number;
  delta: number;
}

function statsFor(history: Telemetry[], key: TelemetryNumericKey): ChannelStats | null {
  if (history.length === 0) return null;
  const values = history.map((point) => point[key]);
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

type TelemetryNumericKey = Exclude<keyof Telemetry, "missionId" | "timestamp">;

function reading(sample: Telemetry, key: TelemetryNumericKey): string {
  const channel = channelByKey(key);
  return `${formatReading(sample[key], channel.decimals)} ${channel.unit}`;
}

function healthPhrase(sample: Telemetry, key: TelemetryNumericKey): string {
  const channel = channelByKey(key);
  const health = evaluateChannel(channel, sample[key]);
  if (health === "NOMINAL") {
    return `${channel.label} is ${reading(sample, key)}, inside its alarm limits`;
  }
  return `${channel.label} is ${reading(sample, key)}, ${health.toLowerCase()}`;
}

function windowPhrase(stats: ChannelStats | null, unit: string): string | null {
  if (!stats) return null;
  const direction = stats.delta > 0.05 ? "rose" : stats.delta < -0.05 ? "fell" : "held nearly steady";
  return `Over the supplied window the reading ${direction} from ${stats.first} ${unit} to ${stats.last} ${unit} (delta ${stats.delta} ${unit}).`;
}

export function buildFallbackInvestigation(
  anomaly: Anomaly,
  sample: Telemetry,
  history: Telemetry[],
): ParsedInvestigation {
  const channel = channelByKey(anomaly.metric);
  const related = CHANNELS.filter((item) => item.key !== anomaly.metric && item.direction !== "none");
  const ownStats = statsFor(history, anomaly.metric);
  const fuelStats = statsFor(history, "fuelRemaining");

  const observations = [
    anomaly.description,
    windowPhrase(ownStats, channel.unit),
    ...related.map((item) => `${healthPhrase(sample, item.key)}.`),
    fuelStats
      ? `Fuel remaining is ${reading(sample, "fuelRemaining")} and changed by ${fuelStats.delta} percentage points across the window.`
      : `Fuel remaining is ${reading(sample, "fuelRemaining")}.`,
  ].filter((item): item is string => Boolean(item));

  const evidence = [
    `${channel.label}: ${reading(sample, channel.key)}`,
    `Alarm threshold (${anomaly.severity.toLowerCase()}): ${anomaly.threshold} ${channel.unit}`,
    channel.warning !== null ? `Warning threshold: ${channel.warning} ${channel.unit}` : null,
    channel.critical !== null ? `Critical threshold: ${channel.critical} ${channel.unit}` : null,
    ...related.map((item) => `${item.label}: ${reading(sample, item.key)}`),
    `Fuel remaining: ${reading(sample, "fuelRemaining")}`,
    `Samples in window: ${history.length}`,
  ].filter((item): item is string => Boolean(item));

  if (anomaly.metric === "engineTemperature") {
    const isolated = related.every((item) => evaluateChannel(item, sample[item.key]) === "NOMINAL");
    const rising = (ownStats?.delta ?? 0) > 40;
    return {
      anomaly_summary: `Observed engine temperature of ${reading(sample, "engineTemperature")} is ${anomaly.severity === "CRITICAL" ? "past the critical limit" : "past the warning limit"}. ${isolated ? "Fuel pressure, battery voltage, and vibration in this sample are still inside their alarm limits, so the excursion is isolated to the thermal reading." : "Other monitored channels are also outside limits and should be reviewed with the thermal reading."} The causes below are hypotheses for operator review, not a confirmed fault.`,
      affected_subsystem: channel.subsystem,
      severity: anomaly.severity,
      observations,
      potential_causes: [
        {
          description:
            "Cooling effectiveness has dropped, allowing chamber or nozzle temperature to climb while the other monitored channels stay quiet.",
          confidence: isolated ? 0.72 : 0.58,
        },
        {
          description:
            "Injector or mixture shift is adding heat. This simulation has no injector telemetry, so the idea rests only on the temperature slope.",
          confidence: rising ? 0.47 : 0.34,
        },
        {
          description:
            "The temperature sensor is biased high. A smooth multi-sample rise makes a single-sample glitch less likely.",
          confidence: rising ? 0.18 : 0.36,
        },
      ],
      recommended_actions: [
        "Compare this temperature reading with any redundant thermal sensor before treating it as a confirmed hot start or cooling failure.",
        "Review the slope and how long the value has stayed above 550 K. The threshold engine, not this narrative, owns the live alarm state.",
        "Do not infer cooling-loop or injector health beyond the channels in this payload. Those sensors are not simulated here.",
        "Hold any propulsive reconfiguration for a human operator. This report does not command the vehicle.",
      ],
      evidence,
    };
  }

  if (anomaly.metric === "fuelPressure") {
    const quantityDrop = Math.abs(Math.min(0, fuelStats?.delta ?? 0));
    const isolated = related.every((item) => evaluateChannel(item, sample[item.key]) === "NOMINAL");
    return {
      anomaly_summary: `Observed fuel pressure of ${reading(sample, "fuelPressure")} is ${anomaly.severity === "CRITICAL" ? "below the critical limit" : "below the warning limit"}. ${isolated ? "Engine temperature, battery voltage, and vibration in this sample remain inside their alarm limits." : "At least one other monitored channel is also outside limits."} Tank quantity movement is reported separately so a leak is not assumed from pressure alone. Causes below are hypotheses.`,
      affected_subsystem: channel.subsystem,
      severity: anomaly.severity,
      observations,
      potential_causes: [
        {
          description:
            "Feed pressure is being lost in the pump, regulator, or line while the rest of the monitored bus still looks nominal.",
          confidence: isolated ? 0.7 : 0.55,
        },
        {
          description:
            "Propellant is leaving the system downstream of the tank. Confidence stays moderate unless quantity is falling with pressure.",
          confidence: quantityDrop >= 0.4 ? 0.63 : 0.41,
        },
        {
          description:
            "The pressure transducer is reading low. A sustained slope is weaker evidence for a one-sample sensor hit.",
          confidence: (ownStats?.delta ?? 0) < -30 ? 0.22 : 0.38,
        },
      ],
      recommended_actions: [
        "Compare the reading with a redundant pressure transducer before calling a leak or a pump failure.",
        "Set the pressure slope next to the fuel-remaining slope. Falling pressure with stable quantity points away from an emptying tank.",
        "Pump and regulator states are not in this telemetry set. Do not invent their readings.",
        "Isolation or cross-feed changes require an operator. This assistant does not command valves or engines.",
      ],
      evidence,
    };
  }

  return {
    anomaly_summary: `Observed ${channel.label.toLowerCase()} of ${reading(sample, anomaly.metric)} crossed a configured ${anomaly.severity.toLowerCase()} threshold. Causes below are hypotheses drawn only from the supplied channels.`,
    affected_subsystem: channel.subsystem,
    severity: anomaly.severity,
    observations,
    potential_causes: [
      {
        description: `${channel.subsystem} performance has moved outside the demo alarm limit on ${channel.label}.`,
        confidence: 0.58,
      },
      {
        description: "The sensor for this channel may be biased. No redundant sensor is present in the simulation to confirm it.",
        confidence: 0.31,
      },
    ],
    recommended_actions: [
      `Review the ${channel.label.toLowerCase()} trend against its warning and critical limits.`,
      "Treat this narrative as an operator aid. It is not a spacecraft command.",
    ],
    evidence,
  };
}

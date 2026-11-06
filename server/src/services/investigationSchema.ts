import type { ParsedInvestigation, Severity } from "../types";

function stringList(value: unknown, max: number): string[] | null {
  const source = typeof value === "string" ? [value] : value;
  if (!Array.isArray(source)) return null;
  const items = source
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
  return items.length > 0 ? items : null;
}

function normalizeConfidence(value: unknown): number | null {
  if (typeof value === "string") {
    const parsed = Number(value.replace("%", "").trim());
    return Number.isFinite(parsed) ? normalizeConfidence(parsed) : null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const scaled = value > 1 && value <= 100 ? value / 100 : value;
  if (value > 1 && value < 2) return null;
  if (scaled < 0 || scaled > 1) return null;
  return Math.round(scaled * 100) / 100;
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Model response did not contain a JSON object");
  }
  return JSON.parse(body.slice(start, end + 1)) as unknown;
}

export function validateInvestigationPayload(input: unknown): ParsedInvestigation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Investigation payload must be an object");
  }
  const record = input as Record<string, unknown>;
  const summary = typeof record.anomaly_summary === "string" ? record.anomaly_summary.trim() : "";
  if (!summary) throw new Error("anomaly_summary is required");

  const subsystem =
    typeof record.affected_subsystem === "string" ? record.affected_subsystem.trim() : "";
  if (!subsystem) throw new Error("affected_subsystem is required");

  let severity: Severity | null = null;
  if (record.severity !== undefined) {
    if (record.severity !== "WARNING" && record.severity !== "CRITICAL") {
      throw new Error("severity must be WARNING or CRITICAL");
    }
    severity = record.severity;
  }

  const observations = stringList(record.observations, 8);
  if (!observations) throw new Error("observations must contain at least one string");

  if (!Array.isArray(record.potential_causes) || record.potential_causes.length === 0) {
    throw new Error("potential_causes must contain at least one cause");
  }
  const causes = record.potential_causes.slice(0, 6).flatMap((cause) => {
    if (!cause || typeof cause !== "object") return [];
    const item = cause as Record<string, unknown>;
    const description = typeof item.description === "string" ? item.description.trim() : "";
    const confidence = normalizeConfidence(item.confidence);
    if (!description || confidence === null) return [];
    return [{ description, confidence }];
  });
  if (causes.length === 0) {
    throw new Error("potential_causes need a description and a confidence between 0 and 1");
  }

  const actions = stringList(record.recommended_actions, 6);
  if (!actions) throw new Error("recommended_actions must contain at least one string");

  const evidence = stringList(record.evidence, 8);
  if (!evidence) throw new Error("evidence must contain at least one string");

  return {
    anomaly_summary: summary.slice(0, 900),
    affected_subsystem: subsystem.slice(0, 120),
    severity,
    observations,
    potential_causes: causes.sort((a, b) => b.confidence - a.confidence),
    recommended_actions: actions,
    evidence,
  };
}

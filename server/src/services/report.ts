import { nextInvestigationId, state } from "../state/store";
import type { Anomaly, Investigation, ParsedInvestigation, Telemetry } from "../types";
import { buildFallbackInvestigation } from "./fallbackService";

export type InvestigationOutcome =
  | { ok: true; data: ParsedInvestigation; model: string }
  | { ok: false; reason: string };

export function finalizeInvestigation(
  anomaly: Anomaly,
  sample: Telemetry,
  history: Telemetry[],
  outcome: InvestigationOutcome,
): Investigation {
  let parsed: ParsedInvestigation;
  let source: Investigation["source"];
  let notice: string | null;
  let model: string | null;

  if (outcome.ok) {
    parsed = outcome.data;
    if (parsed.severity && parsed.severity !== anomaly.severity) {
      parsed = {
        ...parsed,
        anomaly_summary: `${parsed.anomaly_summary} Live alarm severity from the threshold engine is ${anomaly.severity}.`,
      };
    }
    source = "grok";
    notice = null;
    model = outcome.model;
  } else {
    parsed = buildFallbackInvestigation(anomaly, sample, history);
    source = "fallback";
    notice = outcome.reason;
    model = null;
  }

  const record: Investigation = {
    id: nextInvestigationId(),
    anomalyId: anomaly.id,
    summary: parsed.anomaly_summary,
    affectedSubsystem: parsed.affected_subsystem || anomaly.subsystem,
    observations: parsed.observations,
    potentialCauses: [...parsed.potential_causes].sort((a, b) => b.confidence - a.confidence),
    recommendedActions: parsed.recommended_actions,
    evidence: parsed.evidence,
    createdAt: new Date().toISOString(),
    source,
    notice,
    model,
  };

  state.investigations.unshift(record);
  if (state.investigations.length > 100) {
    state.investigations.length = 100;
  }
  return record;
}

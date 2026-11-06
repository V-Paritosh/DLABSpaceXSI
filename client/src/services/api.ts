import { validateInvestigationPayload } from "../../../server/src/services/investigationSchema";
import type { InvestigationOutcome } from "../../../server/src/services/report";

export async function fetchAiStatus(): Promise<{ aiConfigured: boolean; aiModel: string }> {
  try {
    const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("health");
    const body = (await response.json()) as { aiConfigured?: boolean; model?: string };
    return {
      aiConfigured: Boolean(body.aiConfigured),
      aiModel: typeof body.model === "string" && body.model.trim() ? body.model.trim() : "grok-4.7",
    };
  } catch {
    return { aiConfigured: false, aiModel: "grok-4.7" };
  }
}

export async function requestRemoteInvestigation(context: unknown): Promise<InvestigationOutcome> {
  try {
    const response = await fetch("/api/investigate", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(context),
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      data?: unknown;
      model?: string;
      reason?: string;
      error?: string;
    } | null;

    if (!body || typeof body !== "object") {
      return { ok: false, reason: "Grok could not be reached." };
    }
    if (body.ok === true) {
      try {
        const data = validateInvestigationPayload(body.data);
        const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "grok";
        return { ok: true, data, model };
      } catch {
        return { ok: false, reason: "Grok response failed validation. Showing the onboard rule-based assessment." };
      }
    }
    if (typeof body.reason === "string" && body.reason.trim()) {
      return { ok: false, reason: body.reason };
    }
    if (typeof body.error === "string" && body.error.trim()) {
      return { ok: false, reason: body.error };
    }
    return { ok: false, reason: response.ok ? "Grok did not return a usable investigation." : "Grok could not be reached." };
  } catch {
    return { ok: false, reason: "Grok could not be reached." };
  }
}

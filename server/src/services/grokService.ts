import type { ParsedInvestigation } from "../types";
import { extractJsonObject, validateInvestigationPayload } from "./investigationSchema";

export { extractJsonObject, validateInvestigationPayload };

const ENDPOINT = "https://api.x.ai/v1/chat/completions";
const DEFAULT_MODEL = "grok-4.7";

let remoteAiEnabled = true;
const recentCalls: number[] = [];

export function setRemoteAiEnabled(enabled: boolean): void {
  remoteAiEnabled = enabled;
}

export function resetGrokLimiter(): void {
  recentCalls.length = 0;
}

function takeRateSlot(): boolean {
  const now = Date.now();
  while (recentCalls.length > 0 && now - recentCalls[0] > 60_000) {
    recentCalls.shift();
  }
  if (recentCalls.length >= 8) return false;
  recentCalls.push(now);
  return true;
}

export function isRemoteAiEnabled(): boolean {
  return remoteAiEnabled;
}

export interface GrokSuccess {
  ok: true;
  data: ParsedInvestigation;
  model: string;
}

export interface GrokFailure {
  ok: false;
  reason: string;
}

export interface GrokCredentials {
  apiKey: string;
  model?: string;
}

const SYSTEM_PROMPT = `You are Mission Control AI, an aerospace telemetry investigation assistant reviewing SIMULATED data for mission ORBITAL-01.

Rules:
- Use only numbers, thresholds, subsystems, and timestamps present in the user JSON. Do not invent sensors, readings, or events.
- observations and evidence are facts. potential_causes are hypotheses. Say so in anomaly_summary.
- confidence is a number from 0 to 1. Do not use 1. The payload never contains enough evidence for certainty.
- recommended_actions are suggestions for a human operator. Never claim a valve, engine, or spacecraft command was sent. Never instruct the vehicle directly.
- If a channel is inside its thresholds, you may call it nominal. If it is outside, do not call it nominal.
- severity must be exactly the anomaly.severity value from the payload.
- Return one JSON object and nothing else. The keys must be:
  anomaly_summary (string),
  affected_subsystem (string),
  severity ("WARNING" or "CRITICAL"),
  observations (array of strings, at least 2),
  potential_causes (array of objects with description and confidence, at least 2),
  recommended_actions (array of strings, at least 2),
  evidence (array of strings, at least 2, each citing a number from the payload).`;

interface ChatResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

async function postChat(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  includeReasoning: boolean,
): Promise<{ status: number; body: ChatResponse }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.2,
      max_completion_tokens: 1400,
      response_format: { type: "json_object" },
    };
    if (includeReasoning) payload.reasoning_effort = "low";

    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as ChatResponse;
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function failureReason(status: number, body: ChatResponse, fallback: string): string {
  const detail = body.error?.message?.slice(0, 180);
  return detail ? `Grok request failed (${status}): ${detail}` : fallback;
}

export async function requestGrokInvestigation(
  context: unknown,
  credentials?: GrokCredentials,
): Promise<GrokSuccess | GrokFailure> {
  if (!remoteAiEnabled) {
    return { ok: false, reason: "Remote AI disabled for this process." };
  }

  const apiKey = (credentials ? credentials.apiKey : process.env.XAI_API_KEY)?.trim() ?? "";
  if (!apiKey) {
    return {
      ok: false,
      reason:
        "XAI_API_KEY is not set. For local dev, add it to .env in the project root and restart the API. On Netlify, set it in the site environment variables. This report was produced by onboard threshold rules.",
    };
  }

  if (!takeRateSlot()) {
    return {
      ok: false,
      reason: "Investigation rate limit reached. Showing the onboard rule-based assessment.",
    };
  }

  const model = (credentials?.model ?? process.env.XAI_MODEL)?.trim() || DEFAULT_MODEL;
  const baseMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Investigate this simulated anomaly and return JSON.\n${JSON.stringify(context)}`,
    },
  ];

  let messages = baseMessages;
  let includeReasoning = true;
  let lastReason = "Grok did not return a usable investigation.";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let result: { status: number; body: ChatResponse };
    try {
      result = await postChat(apiKey, model, messages, includeReasoning);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      lastReason = timedOut
        ? "Grok did not respond before the investigation timeout."
        : "Grok could not be reached.";
      break;
    }

    if (result.status === 400 && includeReasoning) {
      includeReasoning = false;
      lastReason = failureReason(result.status, result.body, "Grok rejected the request.");
      attempt -= 1;
      continue;
    }

    if (result.status < 200 || result.status >= 300) {
      lastReason = failureReason(result.status, result.body, `Grok request failed (${result.status}).`);
      break;
    }

    const content = result.body.choices?.[0]?.message?.content;
    if (!content) {
      lastReason = "Grok returned an empty investigation.";
      messages = [
        ...baseMessages,
        { role: "user", content: "Your last reply was empty. Return only the JSON object." },
      ];
      continue;
    }

    try {
      const data = validateInvestigationPayload(extractJsonObject(content));
      return { ok: true, data, model: result.body.model || model };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid investigation JSON";
      lastReason = `Grok response failed validation: ${message}`;
      messages = [
        ...baseMessages,
        {
          role: "user",
          content: `The previous JSON was rejected (${message}). Return a corrected JSON object only.`,
        },
      ];
    }
  }

  return { ok: false, reason: lastReason };
}

export function aiConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY?.trim()) && remoteAiEnabled;
}

export function activeModel(): string {
  return process.env.XAI_MODEL?.trim() || DEFAULT_MODEL;
}

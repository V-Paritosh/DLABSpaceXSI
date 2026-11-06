import { isRemoteAiEnabled, requestGrokInvestigation } from "../services/grokService";

const DEFAULT_MODEL = "grok-4.7";
const MAX_BODY = 48_000;

export interface EnvSource {
  get(name: string): string | undefined;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function apiEndpoint(url: string): "health" | "investigate" | null {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url.split("?")[0] ?? url;
  }
  const leaf = pathname.split("/").filter(Boolean).pop() ?? "";
  if (leaf === "health") return "health";
  if (leaf === "investigate") return "investigate";
  return null;
}

function credentials(env: EnvSource): { apiKey: string; model: string } {
  return {
    apiKey: env.get("XAI_API_KEY")?.trim() ?? "",
    model: env.get("XAI_MODEL")?.trim() || DEFAULT_MODEL,
  };
}

export async function handleMissionApi(request: Request, env: EnvSource): Promise<Response> {
  const endpoint = apiEndpoint(request.url);
  if (!endpoint) return json(404, { error: "Not found" });
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  const { apiKey, model } = credentials(env);

  if (endpoint === "health") {
    if (request.method !== "GET") return json(405, { error: "Method not allowed" });
    return json(200, {
      ok: true,
      aiConfigured: Boolean(apiKey) && isRemoteAiEnabled(),
      model,
    });
  }

  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return json(400, { ok: false, reason: "Investigation request body must be JSON." });
  }
  if (raw.length > MAX_BODY) {
    return json(413, { ok: false, reason: "Investigation payload is too large." });
  }

  let context: unknown;
  try {
    context = raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return json(400, { ok: false, reason: "Investigation request body must be JSON." });
  }
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return json(400, { ok: false, reason: "Investigation context must be a JSON object." });
  }

  const record = { ...(context as Record<string, unknown>) };
  delete record.apiKey;
  delete record.XAI_API_KEY;
  delete record.authorization;

  const outcome = await requestGrokInvestigation(record, { apiKey, model });
  return json(200, outcome);
}

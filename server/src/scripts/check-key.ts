import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
const text = fs.readFileSync(envPath, "utf8");
const match = text.match(/^XAI_API_KEY=(.*)$/m);
const key = (match?.[1] ?? "").trim().replace(/^['"]|['"]$/g, "");

if (!key.startsWith("xai-")) {
  console.log(JSON.stringify({ ok: false, reason: "key is missing or does not start with xai-" }));
  process.exit(1);
}

async function main(): Promise<void> {
  const response = await fetch("https://api.x.ai/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = (await response.json().catch(() => ({}))) as {
    data?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  const models = (body.data ?? [])
    .map((item) => item.id ?? "")
    .filter((id) => id.includes("grok-4"))
    .slice(0, 8);

  console.log(
    JSON.stringify({
      ok: response.ok,
      status: response.status,
      message: body.error?.message?.slice(0, 180) ?? null,
      grok4: models,
    }),
  );
}

void main();

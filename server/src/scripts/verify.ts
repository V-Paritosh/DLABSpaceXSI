import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { channelByKey, evaluateChannel } from "../config/channels";
import { createApp } from "../app";
import { handleMissionApi } from "../http/aiHandler";
import { extractJsonObject, requestGrokInvestigation, setRemoteAiEnabled, validateInvestigationPayload } from "../services/grokService";
import { requestInvestigation, resetInvestigationLocks } from "../services/investigationService";
import {
  advanceSimulation,
  getTelemetryView,
  setScenario,
  stopSimulation,
} from "../services/telemetryService";
import { resetState, state } from "../state/store";

function fresh(): void {
  stopSimulation();
  resetInvestigationLocks();
  resetState();
  state.autoInvestigate = false;
}

function stepUntil(
  predicate: () => boolean,
  limit = 16,
): void {
  for (let i = 0; i < limit; i += 1) {
    if (predicate()) return;
    advanceSimulation();
  }
  assert.equal(predicate(), true);
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function testThresholdBoundaries(): void {
  const engine = channelByKey("engineTemperature");
  assert.equal(evaluateChannel(engine, 550), "NOMINAL");
  assert.equal(evaluateChannel(engine, 550.1), "WARNING");
  assert.equal(evaluateChannel(engine, 600), "WARNING");
  assert.equal(evaluateChannel(engine, 600.1), "CRITICAL");

  const fuel = channelByKey("fuelPressure");
  assert.equal(evaluateChannel(fuel, 250), "NOMINAL");
  assert.equal(evaluateChannel(fuel, 249.9), "WARNING");
  assert.equal(evaluateChannel(fuel, 200), "WARNING");
  assert.equal(evaluateChannel(fuel, 199.9), "CRITICAL");

  const battery = channelByKey("batteryVoltage");
  assert.equal(evaluateChannel(battery, 24), "NOMINAL");
  assert.equal(evaluateChannel(battery, 23.9), "WARNING");
  assert.equal(evaluateChannel(battery, 20), "WARNING");
  assert.equal(evaluateChannel(battery, 19.9), "CRITICAL");

  const vibration = channelByKey("vibration");
  assert.equal(evaluateChannel(vibration, 0.5), "NOMINAL");
  assert.equal(evaluateChannel(vibration, 0.51), "WARNING");
  assert.equal(evaluateChannel(vibration, 1), "WARNING");
  assert.equal(evaluateChannel(vibration, 1.01), "CRITICAL");
}

function testNormalScenarioStaysQuiet(): void {
  fresh();
  setScenario("normal");
  for (let i = 0; i < 20; i += 1) advanceSimulation();
  assert.equal(state.anomalies.length, 0);
  assert.equal(state.mission.status, "NOMINAL");
  const view = getTelemetryView();
  assert.ok(view);
  assert.equal(view.channels.length, 5);
  assert.ok(view.channels.every((channel) => channel.status === "NOMINAL"));
}

function testEngineScenario(): void {
  fresh();
  setScenario("engine-overheating");
  stepUntil(
    () =>
      state.anomalies.some(
        (anomaly) => anomaly.metric === "engineTemperature" && anomaly.severity === "WARNING",
      ),
  );
  const duringWarning = state.anomalies.filter((anomaly) => anomaly.metric === "engineTemperature");
  assert.equal(duringWarning.length, 1);
  const id = duringWarning[0].id;

  stepUntil(
    () =>
      state.anomalies.some(
        (anomaly) => anomaly.metric === "engineTemperature" && anomaly.severity === "CRITICAL",
      ),
  );
  const engine = state.anomalies.filter((anomaly) => anomaly.metric === "engineTemperature");
  assert.equal(engine.length, 1);
  assert.equal(engine[0].id, id);
  assert.equal(engine[0].severity, "CRITICAL");
  assert.equal(state.mission.status, "CRITICAL");
  assert.ok(engine[0].observedValue > 600);

  setScenario("normal");
  const resolved = state.anomalies.find((anomaly) => anomaly.id === id);
  assert.equal(resolved?.status, "RESOLVED");
  assert.equal(state.mission.status, "NOMINAL");
}

function testFuelScenario(): void {
  fresh();
  setScenario("fuel-pressure-drop");
  stepUntil(
    () =>
      state.anomalies.some(
        (anomaly) => anomaly.metric === "fuelPressure" && anomaly.severity === "CRITICAL",
      ),
  );
  const fuel = state.anomalies.filter((anomaly) => anomaly.metric === "fuelPressure");
  assert.equal(fuel.length, 1);
  assert.ok(fuel[0].observedValue < 200);
  assert.equal(fuel[0].subsystem, "Fuel");
  assert.equal(state.mission.status, "CRITICAL");
}

function testPayloadValidation(): void {
  const parsed = validateInvestigationPayload({
    anomaly_summary: "Temperature is high.",
    affected_subsystem: "Propulsion",
    severity: "CRITICAL",
    observations: ["Temperature rose."],
    potential_causes: [
      { description: "Cooling loss", confidence: 80 },
      { description: "Bad sensor", confidence: "0.2" },
    ],
    recommended_actions: ["Compare redundant sensors."],
    evidence: ["Engine temperature: 640 K"],
  });
  assert.equal(parsed.potential_causes[0].confidence, 0.8);
  assert.equal(parsed.potential_causes[1].confidence, 0.2);

  const wrapped = extractJsonObject("```json\n{\"anomaly_summary\":\"x\"}\n```");
  assert.equal((wrapped as { anomaly_summary: string }).anomaly_summary, "x");

  assert.throws(() => validateInvestigationPayload({ anomaly_summary: "only this" }));
  assert.throws(() =>
    validateInvestigationPayload({
      anomaly_summary: "Temperature is high.",
      affected_subsystem: "Propulsion",
      observations: ["Temperature rose."],
      potential_causes: [{ description: "Cooling loss", confidence: 1.4 }],
      recommended_actions: ["Review."],
      evidence: ["640 K"],
    }),
  );
}

async function testFallbackInvestigation(): Promise<void> {
  fresh();
  setRemoteAiEnabled(false);
  setScenario("engine-overheating");
  stepUntil(
    () => state.anomalies.some((anomaly) => anomaly.severity === "CRITICAL"),
  );
  const anomaly = state.anomalies[0];
  const report = await requestInvestigation(anomaly.id, "manual");
  assert.equal(report.source, "fallback");
  assert.equal(report.anomalyId, anomaly.id);
  assert.ok(report.summary.length > 20);
  assert.ok(report.observations.length >= 1);
  assert.ok(report.potentialCauses.length >= 1);
  assert.ok(report.recommendedActions.length >= 1);
  assert.ok(report.evidence.length >= 1);
  assert.ok(report.potentialCauses.every((cause) => cause.confidence >= 0 && cause.confidence <= 1));
  assert.equal(state.anomalies[0].status, "INVESTIGATED");
  assert.match(report.evidence.join(" "), /K/);
}

async function testAutoInvestigationOnCritical(): Promise<void> {
  fresh();
  state.autoInvestigate = true;
  setRemoteAiEnabled(false);
  setScenario("fuel-pressure-drop");
  stepUntil(
    () => state.anomalies.some((anomaly) => anomaly.metric === "fuelPressure" && anomaly.severity === "CRITICAL"),
  );
  await waitFor(() => state.investigations.length === 1);
  assert.equal(state.investigations[0].source, "fallback");
  assert.equal(state.anomalies[0].status, "INVESTIGATED");
}

async function testAiHttp(): Promise<void> {
  fresh();
  setRemoteAiEnabled(false);
  const server = createApp().listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind to a port");
  }
  const base = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("cache-control"), "no-store");
    const healthBody = (await health.json()) as { ok: boolean; aiConfigured: boolean; model: string };
    assert.equal(healthBody.ok, true);
    assert.equal(healthBody.aiConfigured, false);
    assert.ok(healthBody.model.length > 0);

    const missing = await fetch(`${base}/api/telemetry`);
    assert.equal(missing.status, 404);

    const bad = await fetch(`${base}/api/investigate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    assert.equal(bad.status, 400);

    const investigation = await fetch(`${base}/api/investigate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mission: { id: "orbital-01" }, note: "simulated" }),
    });
    assert.equal(investigation.status, 200);
    const report = (await investigation.json()) as { ok: boolean; reason?: string };
    assert.equal(report.ok, false);
    assert.match(report.reason ?? "", /Remote AI disabled/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function testHandlerReadsCallerEnv(): Promise<void> {
  setRemoteAiEnabled(true);
  const secret = "xai-this-must-not-leak";
  try {
    const health = await handleMissionApi(new Request("https://mission.example/api/health"), {
      get: (name) => (name === "XAI_API_KEY" ? secret : name === "XAI_MODEL" ? "grok-demo" : undefined),
    });
    const healthText = await health.text();
    const healthBody = JSON.parse(healthText) as { aiConfigured: boolean; model: string };
    assert.equal(healthBody.aiConfigured, true);
    assert.equal(healthBody.model, "grok-demo");
    assert.equal(healthText.includes(secret), false);
    assert.equal(healthText.includes("XAI_API_KEY"), false);

    const rewritten = await handleMissionApi(
      new Request("https://mission.example/.netlify/functions/api/health"),
      { get: () => undefined },
    );
    const rewrittenBody = (await rewritten.json()) as { ok: boolean; aiConfigured: boolean };
    assert.equal(rewritten.status, 200);
    assert.equal(rewrittenBody.ok, true);
    assert.equal(rewrittenBody.aiConfigured, false);

    const missingKey = await requestGrokInvestigation({ anomaly: "test" }, { apiKey: "", model: "grok-4.7" });
    assert.equal(missingKey.ok, false);
    if (!missingKey.ok) {
      assert.match(missingKey.reason, /XAI_API_KEY is not set/);
      assert.match(missingKey.reason, /onboard threshold rules/);
    }
  } finally {
    setRemoteAiEnabled(false);
  }
}

async function main(): Promise<void> {
  setRemoteAiEnabled(false);
  testThresholdBoundaries();
  testPayloadValidation();
  testNormalScenarioStaysQuiet();
  testEngineScenario();
  testFuelScenario();
  await testFallbackInvestigation();
  await testAutoInvestigationOnCritical();
  await testAiHttp();
  await testHandlerReadsCallerEnv();
  stopSimulation();
  console.log("Mission Control verification passed");
}

main().catch((error: unknown) => {
  console.error(error);
  stopSimulation();
  process.exit(1);
});

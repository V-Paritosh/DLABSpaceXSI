import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readDashboard, runInvestigation, selectScenario, startMissionLoop, subscribe } from "../simulation/runtime";
import { fetchAiStatus } from "../services/api";
import type { Anomaly, DashboardData, Investigation, ScenarioId } from "../types";

export type LinkState = "connecting" | "online" | "offline";

function latestInvestigation(investigations: Investigation[], anomalyId: string): Investigation | null {
  return investigations.find((item) => item.anomalyId === anomalyId) ?? null;
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [link, setLink] = useState<LinkState>("connecting");
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [investigateError, setInvestigateError] = useState<string | null>(null);
  const [pendingInvestigation, setPendingInvestigation] = useState(false);
  const aiRef = useRef({ aiConfigured: false, aiModel: "grok-4.7" });

  const publish = useCallback(() => {
    const next = readDashboard(aiRef.current);
    setData(next);
    setLink(next ? "online" : "connecting");
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe(publish);
    const stop = startMissionLoop();
    publish();
    return () => {
      unsubscribe();
      stop();
    };
  }, [publish]);

  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      void fetchAiStatus().then((status) => {
        if (cancelled) return;
        aiRef.current = status;
        publish();
      });
    };
    ping();
    const timer = window.setInterval(ping, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [publish]);

  const changeScenario = useCallback((next: ScenarioId) => {
    setPinnedId(null);
    setScenarioError(null);
    setInvestigateError(null);
    selectScenario(next);
  }, []);

  const investigate = useCallback(async (anomalyId: string) => {
    setPendingInvestigation(true);
    setInvestigateError(null);
    setPinnedId(anomalyId);
    try {
      await runInvestigation(anomalyId, "manual");
    } catch (error) {
      setInvestigateError(error instanceof Error ? error.message : "Investigation failed");
    } finally {
      setPendingInvestigation(false);
    }
  }, []);

  const anomalies = data?.anomalies ?? [];
  const investigations = data?.investigations ?? [];

  const selected = useMemo<Anomaly | null>(() => {
    if (pinnedId) {
      const pinned = anomalies.find((anomaly) => anomaly.id === pinnedId);
      if (pinned) return pinned;
    }
    return anomalies.find((anomaly) => anomaly.status !== "RESOLVED") ?? anomalies[0] ?? null;
  }, [anomalies, pinnedId]);

  const investigation = selected ? latestInvestigation(investigations, selected.id) : null;
  const revisionCount = selected ? investigations.filter((item) => item.anomalyId === selected.id).length : 0;

  return {
    data,
    link,
    scenario: data?.mission.scenario ?? "normal",
    scenarioError,
    selectScenario: changeScenario,
    anomalies,
    openAnomalies: anomalies.filter((anomaly) => anomaly.status !== "RESOLVED"),
    selected,
    pinned: pinnedId !== null,
    pinAnomaly: setPinnedId,
    clearPin: () => setPinnedId(null),
    investigation,
    revisionCount,
    investigate,
    investigateError,
    pendingInvestigation,
  };
}

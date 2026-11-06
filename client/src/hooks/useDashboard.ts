import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { investigateAnomaly, loadDashboard, setScenario } from "../services/api";
import type { Anomaly, DashboardData, Investigation, ScenarioId } from "../types";

export type LinkState = "connecting" | "online" | "offline";

function latestInvestigation(investigations: Investigation[], anomalyId: string): Investigation | null {
  return investigations.find((item) => item.anomalyId === anomalyId) ?? null;
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [link, setLink] = useState<LinkState>("connecting");
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [scenarioPending, setScenarioPending] = useState<ScenarioId | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [investigateError, setInvestigateError] = useState<string | null>(null);
  const [pendingInvestigation, setPendingInvestigation] = useState(false);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    try {
      const next = await loadDashboard();
      if (id !== seq.current) return;
      setData(next);
      setLink("online");
      setScenarioPending((current) => (current && next.mission.scenario === current ? null : current));
    } catch {
      if (id !== seq.current) return;
      setLink("offline");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const selectScenario = useCallback(
    async (next: ScenarioId) => {
      setScenarioPending(next);
      setPinnedId(null);
      setScenarioError(null);
      setInvestigateError(null);
      try {
        await setScenario(next);
        await refresh();
      } catch (error) {
        setScenarioPending(null);
        setScenarioError(error instanceof Error ? error.message : "Scenario change failed");
      }
    },
    [refresh],
  );

  const investigate = useCallback(
    async (anomalyId: string) => {
      setPendingInvestigation(true);
      setInvestigateError(null);
      setPinnedId(anomalyId);
      try {
        await investigateAnomaly(anomalyId);
        await refresh();
      } catch (error) {
        setInvestigateError(error instanceof Error ? error.message : "Investigation failed");
        await refresh();
      } finally {
        setPendingInvestigation(false);
      }
    },
    [refresh],
  );

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
  const revisionCount = selected
    ? investigations.filter((item) => item.anomalyId === selected.id).length
    : 0;

  return {
    data,
    link,
    scenario: scenarioPending ?? data?.mission.scenario ?? "normal",
    scenarioError,
    selectScenario,
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

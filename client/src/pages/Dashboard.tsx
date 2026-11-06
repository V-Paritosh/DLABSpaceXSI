import { useEffect, useState } from "react";
import { AnomalyFeed } from "../components/AnomalyFeed";
import { InvestigationPanel } from "../components/InvestigationPanel";
import { MissionHeader } from "../components/MissionHeader";
import { ScenarioControls } from "../components/ScenarioControls";
import { TelemetryCard } from "../components/TelemetryCard";
import { TelemetryChart } from "../components/TelemetryChart";
import { useDashboard } from "../hooks/useDashboard";

export function Dashboard() {
  const dash = useDashboard();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const channels = dash.data?.telemetry.channels ?? [];
  const charts = channels.filter((channel) => channel.chart);
  const points = dash.data?.history.points ?? [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-navy font-sans text-ink">
      <MissionHeader mission={dash.data?.mission ?? null} link={dash.link} now={now} />
      {dash.link === "offline" ? (
        <div className="shrink-0 border-b border-alert px-4 py-1.5 text-[11px] tracking-[0.14em] text-alert">
          TELEMETRY LINK LOST — RETRYING. THE LAST SAMPLE STAYS ON SCREEN WHEN ONE HAS BEEN RECEIVED.
        </div>
      ) : null}
      <main className="min-h-0 flex-1 overflow-auto px-3 py-3">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-2">
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-5">
            {channels.length === 0 ? (
              <p className="col-span-full border border-steel bg-panel px-3 py-6 text-[12px] tracking-[0.14em] text-haze">
                AWAITING TELEMETRY
              </p>
            ) : (
              channels.map((channel) => <TelemetryCard key={channel.key} channel={channel} />)
            )}
          </section>

          <section className="grid grid-cols-1 items-stretch gap-2 xl:h-[392px] xl:grid-cols-5 xl:overflow-hidden">
            <div className="grid min-h-0 grid-cols-1 gap-2 md:grid-cols-2 xl:col-span-3 xl:h-full xl:grid-rows-2">
              {charts.map((channel) => (
                <TelemetryChart key={channel.key} channel={channel} points={points} />
              ))}
            </div>
            <div className="min-h-[320px] xl:col-span-2 xl:h-full xl:min-h-0">
              <InvestigationPanel
                anomaly={dash.selected}
                investigation={dash.investigation}
                revisionCount={dash.revisionCount}
                aiConfigured={dash.data?.mission.aiConfigured ?? false}
                pending={dash.pendingInvestigation}
                error={dash.investigateError}
                pinned={dash.pinned}
                onInvestigate={(id) => void dash.investigate(id)}
                onFollowLatest={dash.clearPin}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <AnomalyFeed
              title="Active Anomalies"
              anomalies={dash.openAnomalies}
              empty="NO ACTIVE ANOMALIES — ALL MONITORED CHANNELS ARE INSIDE LIMITS."
              selectedId={dash.selected?.id ?? null}
              onSelect={dash.pinAnomaly}
            />
            <AnomalyFeed
              title="Incident History"
              anomalies={dash.anomalies}
              empty="NO INCIDENTS RECORDED."
              selectedId={dash.selected?.id ?? null}
              onSelect={dash.pinAnomaly}
            />
          </section>
        </div>
      </main>
      <ScenarioControls
        active={dash.scenario}
        error={dash.scenarioError}
        onSelect={(scenario) => void dash.selectScenario(scenario)}
      />
    </div>
  );
}

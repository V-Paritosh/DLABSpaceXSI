import type { LinkState } from "../hooks/useDashboard";
import type { MissionResponse } from "../types";
import { formatMissionTime } from "../utils/format";
import { MissionStatus } from "./MissionStatus";

interface MissionHeaderProps {
  mission: MissionResponse | null;
  link: LinkState;
  now: Date;
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-medium tracking-[0.18em] text-haze">{label}</div>
      <div className={`truncate text-[12px] text-ink ${mono ? "font-mono" : "font-medium tracking-wide"}`}>
        {value}
      </div>
    </div>
  );
}

function Mark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect x="0.5" y="0.5" width="31" height="31" fill="#0B1120" stroke="#263449" />
      <circle cx="16" cy="16" r="8" fill="none" stroke="#E8EDF5" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="1.6" fill="#F5B942" />
      <path d="M16 4 V8 M16 24 V28 M4 16 H8 M24 16 H28" stroke="#94A3B8" strokeWidth="1.2" />
    </svg>
  );
}

export function MissionHeader({ mission, link, now }: MissionHeaderProps) {
  const status = mission?.status ?? "NOMINAL";
  const bar = status === "CRITICAL" ? "bg-alert" : status === "WARNING" ? "bg-signal" : "bg-olive";
  const sim =
    link === "offline" ? "LINK LOST" : link === "connecting" || !mission ? "SYNCING" : mission.simulationActive ? "ACTIVE" : "HELD";

  return (
    <header className="shrink-0 border-b border-steel bg-panel">
      <div className={`h-1 ${bar}`} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Mark />
          <div>
            <h1 className="text-[13px] font-semibold tracking-[0.2em] text-ink">MISSION CONTROL AI</h1>
            <p className="text-[10px] tracking-[0.14em] text-haze">ANOMALY INVESTIGATION · NO VEHICLE COMMAND</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 md:ml-auto">
          <Meta label="MISSION" value={mission?.name ?? "ORBITAL-01"} />
          <Meta label="SCENARIO" value={mission?.scenarioLabel ?? "—"} />
          <div>
            <div className="text-[9px] font-medium tracking-[0.18em] text-haze">SIMULATION</div>
            <div className="flex items-center gap-2 text-[12px] font-medium tracking-wide text-ink">
              <span
                className={`inline-block h-1.5 w-1.5 ${link === "online" ? "live-dot bg-signal" : "bg-haze"}`}
              />
              {sim}
            </div>
          </div>
          <Meta label="UTC" value={formatMissionTime(now)} mono />
          <div
            className={`border px-2 py-1 text-[10px] tracking-[0.14em] ${
              mission?.aiConfigured ? "border-olive text-ink" : "border-signal text-signal"
            }`}
          >
            {mission?.aiConfigured ? mission.aiModel.toUpperCase() : "GROK OFFLINE"}
          </div>
          <MissionStatus status={status} />
        </div>
      </div>
    </header>
  );
}

import { useEffect, useState } from "react";
import type { Anomaly, Investigation } from "../types";
import { formatClock, formatConfidence, formatValue } from "../utils/format";
import { Panel } from "./Panel";

interface InvestigationPanelProps {
  anomaly: Anomaly | null;
  investigation: Investigation | null;
  revisionCount: number;
  aiConfigured: boolean;
  pending: boolean;
  error: string | null;
  pinned: boolean;
  onInvestigate: (id: string) => void;
  onFollowLatest: () => void;
}

const PHASES_GROK = [
  "COLLECTING CHANNEL SNAPSHOT",
  "COMPARING OPERATING LIMITS",
  "SEPARATING FACT FROM HYPOTHESIS",
  "RANKING PLAUSIBLE CAUSES",
  "DRAFTING OPERATOR ACTIONS",
];

const PHASES_RULES = ["COLLECTING CHANNEL SNAPSHOT", "COMPARING OPERATING LIMITS", "APPLYING ONBOARD RULES"];

function decimalsFor(unit: string): number {
  if (unit === "V" || unit === "%") return 2;
  if (unit === "G") return 3;
  return 1;
}

function LoadingBlock({ aiConfigured, elapsed }: { aiConfigured: boolean; elapsed: number }) {
  const phases = aiConfigured ? PHASES_GROK : PHASES_RULES;
  const phase = phases[Math.floor(elapsed / 2) % phases.length];
  return (
    <div className="border border-steel bg-navy px-3 py-3">
      <div className="text-[10px] font-medium tracking-[0.16em] text-signal">INVESTIGATION IN PROGRESS</div>
      <div className="mt-1 font-mono text-[12px] text-ink">{phase}</div>
      <div className="mt-3 h-1 overflow-hidden bg-steel">
        <div className="sweep-bar h-1 w-1/3 bg-signal" />
      </div>
      <div className="mt-2 font-mono text-[10px] text-haze">ELAPSED {String(elapsed).padStart(2, "0")}S</div>
    </div>
  );
}

function EvidenceItem({ item }: { item: string }) {
  const splitAt = item.indexOf(":");
  const label = splitAt === -1 ? "NOTE" : item.slice(0, splitAt);
  const value = splitAt === -1 ? item : item.slice(splitAt + 1).trim();
  return (
    <div className="border border-steel bg-navy px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.14em] text-haze">{label}</div>
      <div className="mt-0.5 font-mono text-[12px] leading-5 text-ink">{value}</div>
    </div>
  );
}

export function InvestigationPanel({
  anomaly,
  investigation,
  revisionCount,
  aiConfigured,
  pending,
  error,
  pinned,
  onInvestigate,
  onFollowLatest,
}: InvestigationPanelProps) {
  const busy = pending || anomaly?.status === "INVESTIGATING";
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [busy, anomaly?.id]);

  const aside = investigation ? (
    <span className="font-mono text-ink">{investigation.id}</span>
  ) : (
    <span>NO REPORT</span>
  );

  return (
    <Panel title="AI INVESTIGATION" aside={aside} className="h-full min-h-[320px] xl:min-h-0" bodyClassName="overflow-y-auto">
      <div className="flex flex-col gap-3 p-3">
        {!anomaly ? (
          <div className="border border-steel bg-navy px-3 py-6">
            <p className="text-[12px] font-medium tracking-[0.14em] text-ink">NO ANOMALY SELECTED</p>
            <p className="mt-2 text-[12px] leading-5 text-haze">
              Channels inside their limits do not open an investigation. Inject a scenario, or select an incident from
              history.
            </p>
          </div>
        ) : (
          <>
            <div className="border border-steel bg-navy px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] tracking-[0.16em] text-haze">
                  {anomaly.subsystem.toUpperCase()} · {anomaly.id}
                </div>
                <span
                  className={`px-1.5 py-0.5 text-[10px] tracking-[0.14em] ${
                    anomaly.severity === "CRITICAL" ? "bg-alert text-white" : "bg-signal text-navy"
                  }`}
                >
                  {anomaly.severity}
                </span>
              </div>
              <h3 className="mt-1 text-[14px] font-semibold text-ink">{anomaly.name}</h3>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <dt className="tracking-[0.14em] text-haze">OBSERVED</dt>
                  <dd className="font-mono text-ink">
                    {formatValue(anomaly.observedValue, decimalsFor(anomaly.unit))} {anomaly.unit}
                  </dd>
                </div>
                <div>
                  <dt className="tracking-[0.14em] text-haze">THRESHOLD</dt>
                  <dd className="font-mono text-ink">
                    {formatValue(anomaly.threshold, decimalsFor(anomaly.unit))} {anomaly.unit}
                  </dd>
                </div>
                <div>
                  <dt className="tracking-[0.14em] text-haze">DETECTED</dt>
                  <dd className="font-mono text-ink">{formatClock(anomaly.timestamp)}</dd>
                </div>
                <div>
                  <dt className="tracking-[0.14em] text-haze">STATE</dt>
                  <dd className="text-ink">{anomaly.status}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onInvestigate(anomaly.id)}
                  className="h-8 border border-steel px-3 text-[10px] font-medium tracking-[0.14em] text-ink hover:border-haze disabled:cursor-wait disabled:text-haze"
                >
                  {busy ? "INVESTIGATION RUNNING" : investigation ? "RE-RUN INVESTIGATION" : "INVESTIGATE"}
                </button>
                {pinned ? (
                  <button
                    type="button"
                    onClick={onFollowLatest}
                    className="h-8 border border-steel px-3 text-[10px] font-medium tracking-[0.14em] text-haze hover:text-ink"
                  >
                    FOLLOW LATEST
                  </button>
                ) : null}
              </div>
            </div>

            {error ? (
              <p className="border border-alert px-3 py-2 text-[12px] leading-5 text-alert">{error}</p>
            ) : null}

            {busy && !investigation ? <LoadingBlock aiConfigured={aiConfigured} elapsed={elapsed} /> : null}

            {busy && investigation ? (
              <p className="border border-signal px-3 py-2 text-[11px] tracking-[0.12em] text-signal">
                UPDATING REPORT · ELAPSED {String(elapsed).padStart(2, "0")}S
              </p>
            ) : null}

            {!busy && !investigation ? (
              <p className="text-[12px] leading-5 text-haze">
                {anomaly.severity === "WARNING"
                  ? "Warning is open. Investigation starts automatically if the reading reaches the critical limit, or when you run it."
                  : "Critical alarm is queued for investigation. A report will replace this notice."}
              </p>
            ) : null}

            {investigation ? (
              <article className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-[0.14em]">
                  <span className={`border px-1.5 py-0.5 ${investigation.source === "grok" ? "border-olive text-ink" : "border-signal text-signal"}`}>
                    {investigation.source === "grok" ? `SOURCE ${investigation.model ?? "GROK"}` : "SOURCE ONBOARD RULES"}
                  </span>
                  <span className="font-mono text-haze">{formatClock(investigation.createdAt)}</span>
                  {revisionCount > 1 ? <span className="text-haze">REVISION {revisionCount}</span> : null}
                </div>

                {investigation.notice ? (
                  <p className="border border-signal bg-navy px-3 py-2 text-[12px] leading-5 text-signal">
                    {investigation.notice}
                  </p>
                ) : null}

                <section>
                  <h4 className="text-[10px] font-semibold tracking-[0.16em] text-haze">ANOMALY SUMMARY</h4>
                  <p className="mt-1 text-[13px] leading-6 text-ink">{investigation.summary}</p>
                  <p className="mt-1 text-[11px] text-haze">Affected subsystem · {investigation.affectedSubsystem}</p>
                </section>

                <section>
                  <h4 className="text-[10px] font-semibold tracking-[0.16em] text-haze">OBSERVED</h4>
                  <ol className="mt-1 flex flex-col gap-1.5">
                    {investigation.observations.map((item, index) => (
                      <li key={`${investigation.id}-obs-${index}`} className="flex gap-2 text-[12px] leading-5 text-ink">
                        <span className="font-mono text-haze">{String(index + 1).padStart(2, "0")}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </section>

                <section>
                  <h4 className="text-[10px] font-semibold tracking-[0.16em] text-haze">HYPOTHESES</h4>
                  <div className="mt-1 flex flex-col gap-2">
                    {investigation.potentialCauses.map((cause, index) => (
                      <div key={`${investigation.id}-cause-${index}`} className="border border-steel px-2.5 py-2">
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <span className="text-[10px] tracking-[0.14em] text-haze">CONFIDENCE</span>
                          <span className="font-mono text-[12px] text-ink">{formatConfidence(cause.confidence)}</span>
                        </div>
                        <div className="mb-2 h-1 bg-steel">
                          <div
                            className="h-1 bg-signal"
                            style={{ width: `${Math.round(cause.confidence * 100)}%` }}
                          />
                        </div>
                        <p className="text-[12px] leading-5 text-ink">{cause.description}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-semibold tracking-[0.16em] text-haze">
                    RECOMMENDED ACTIONS · HUMAN REVIEW ONLY
                  </h4>
                  <ol className="mt-1 flex flex-col gap-1.5">
                    {investigation.recommendedActions.map((item, index) => (
                      <li
                        key={`${investigation.id}-act-${index}`}
                        className="border border-steel bg-navy px-2.5 py-2 text-[12px] leading-5 text-ink"
                      >
                        <span className="mr-2 font-mono text-haze">{String(index + 1).padStart(2, "0")}</span>
                        {item}
                      </li>
                    ))}
                  </ol>
                </section>

                <section>
                  <h4 className="text-[10px] font-semibold tracking-[0.16em] text-haze">SUPPORTING EVIDENCE</h4>
                  <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {investigation.evidence.map((item, index) => (
                      <EvidenceItem key={`${investigation.id}-ev-${index}`} item={item} />
                    ))}
                  </div>
                </section>
              </article>
            ) : null}
          </>
        )}

        <p className="text-[10px] leading-4 tracking-wide text-haze">
          Findings are hypotheses about simulated telemetry. Mission Control AI does not command spacecraft systems.
        </p>
      </div>
    </Panel>
  );
}

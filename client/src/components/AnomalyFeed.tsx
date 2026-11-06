import type { Anomaly } from "../types";
import { formatClock, formatValue } from "../utils/format";
import { Panel } from "./Panel";

interface AnomalyFeedProps {
  title: string;
  anomalies: Anomaly[];
  empty: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const SEVERITY: Record<string, string> = {
  WARNING: "bg-signal text-navy",
  CRITICAL: "bg-alert text-white",
};

const STATE: Record<Anomaly["status"], string> = {
  ACTIVE: "text-signal",
  INVESTIGATING: "text-ink",
  INVESTIGATED: "text-ink",
  RESOLVED: "text-haze",
};

export function AnomalyFeed({ title, anomalies, empty, selectedId, onSelect }: AnomalyFeedProps) {
  return (
    <Panel title={title} aside={`${String(anomalies.length).padStart(2, "0")}`}>
      {anomalies.length === 0 ? (
        <p className="px-3 py-6 text-[12px] tracking-wide text-haze">{empty}</p>
      ) : (
        <div className="max-h-52 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-panel text-[9px] uppercase tracking-[0.14em] text-haze">
              <tr className="border-b border-steel">
                <th className="px-3 py-1.5 font-medium">Anomaly</th>
                <th className="px-2 py-1.5 font-medium">Subsystem</th>
                <th className="px-2 py-1.5 font-medium">Severity</th>
                <th className="px-2 py-1.5 font-medium">Observed</th>
                <th className="hidden px-2 py-1.5 font-medium md:table-cell">Threshold</th>
                <th className="px-2 py-1.5 font-medium">Time</th>
                <th className="px-3 py-1.5 font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((anomaly) => {
                const selected = anomaly.id === selectedId;
                const decimals = anomaly.unit === "V" ? 2 : anomaly.unit === "G" ? 3 : anomaly.unit === "%" ? 2 : 1;
                return (
                  <tr
                    key={anomaly.id}
                    tabIndex={0}
                    onClick={() => onSelect(anomaly.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(anomaly.id);
                      }
                    }}
                    className={`cursor-pointer border-b border-steel/80 text-[12px] outline-none focus-visible:bg-navy ${
                      selected ? "bg-navy" : "hover:bg-navy/70"
                    }`}
                  >
                    <td className="px-3 py-1.5">
                      <div className="font-medium text-ink">{anomaly.name}</div>
                      <div className="font-mono text-[10px] text-haze">{anomaly.id}</div>
                    </td>
                    <td className="px-2 py-1.5 text-haze">{anomaly.subsystem}</td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-block px-1.5 py-0.5 text-[10px] tracking-[0.12em] ${SEVERITY[anomaly.severity]}`}>
                        {anomaly.severity}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-ink">
                      {formatValue(anomaly.observedValue, decimals)} {anomaly.unit}
                    </td>
                    <td className="hidden px-2 py-1.5 font-mono text-haze md:table-cell">
                      {formatValue(anomaly.threshold, decimals)} {anomaly.unit}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-haze">{formatClock(anomaly.timestamp)}</td>
                    <td className={`px-3 py-1.5 text-[10px] tracking-[0.12em] ${STATE[anomaly.status]}`}>
                      {anomaly.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

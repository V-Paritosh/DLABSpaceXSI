import { Activity, Battery, Fuel, Gauge, Thermometer } from "lucide-react";
import type { ChannelSnapshot } from "../types";
import { formatDelta, formatValue } from "../utils/format";

const ICONS = {
  engineTemperature: Thermometer,
  fuelPressure: Gauge,
  batteryVoltage: Battery,
  vibration: Activity,
  fuelRemaining: Fuel,
};

const BARS = {
  NOMINAL: "bg-olive",
  WARNING: "bg-signal",
  CRITICAL: "bg-alert",
};

const VALUE = {
  NOMINAL: "text-ink",
  WARNING: "text-signal",
  CRITICAL: "text-alert",
};

export function TelemetryCard({ channel }: { channel: ChannelSnapshot }) {
  const Icon = ICONS[channel.key];
  const limit =
    channel.direction === "high"
      ? `WRN ${channel.warning} · CRT ${channel.critical}`
      : channel.direction === "low"
        ? `WRN ${channel.warning} · CRT ${channel.critical}`
        : "Quantity trend only";

  return (
    <article className="group relative flex min-w-0 border border-steel bg-panel">
      <div className={`w-1 shrink-0 ${BARS[channel.status]}`} />
      <div className="min-w-0 flex-1 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-haze">
            {channel.subsystem}
          </div>
          <Icon size={14} strokeWidth={1.75} className="shrink-0 text-haze" aria-hidden="true" />
        </div>
        <h3 className="mt-1 truncate text-[12px] font-medium text-ink">{channel.label}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className={`font-mono text-[22px] leading-none tracking-tight ${VALUE[channel.status]}`}>
            {formatValue(channel.value, channel.decimals)}
          </span>
          <span className="font-mono text-[11px] text-haze">{channel.unit}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] tracking-wide text-haze">
          <span className="truncate">NOM {channel.nominalText}</span>
          <span className="shrink-0 font-mono text-ink">
            10s {channel.trend === null ? "—" : formatDelta(channel.trend, channel.decimals)}
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute left-0 top-[calc(100%+4px)] z-20 hidden w-56 border border-steel bg-navy p-2 text-[11px] leading-5 text-haze shadow-none group-hover:block">
        <div className="font-medium tracking-[0.14em] text-ink">{channel.status}</div>
        <div>{limit}</div>
        <div>Range shown on the card is the warning boundary.</div>
        <div>10s change is the latest sample minus the sample from ten seconds earlier.</div>
      </div>
    </article>
  );
}

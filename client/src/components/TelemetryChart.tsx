import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChannelSnapshot, Telemetry } from "../types";
import { formatClock, formatValue } from "../utils/format";

interface TelemetryChartProps {
  channel: ChannelSnapshot;
  points: Telemetry[];
}

export function TelemetryChart({ channel, points }: TelemetryChartProps) {
  const stroke = channel.status === "CRITICAL" ? "#EF4444" : channel.status === "WARNING" ? "#F5B942" : "#C5D0DE";
  const data = points.map((point) => ({
    label: formatClock(point.timestamp),
    value: point[channel.key],
  }));
  const limits =
    channel.warning !== null && channel.critical !== null
      ? `WRN ${channel.warning} · CRT ${channel.critical} ${channel.unit}`
      : channel.unit;

  return (
    <section className="flex h-[176px] min-h-0 flex-col overflow-hidden border border-steel bg-panel xl:h-full">
      <header className="flex items-baseline justify-between gap-3 border-b border-steel px-3 py-1.5">
        <div className="min-w-0">
          <h3 className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-haze">
            {channel.label}
          </h3>
          <p className="font-mono text-[10px] text-haze">{limits}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-[13px] text-ink">
            {formatValue(channel.value, channel.decimals)}
            <span className="ml-1 text-[10px] text-haze">{channel.unit}</span>
          </div>
          <div
            className={`text-[10px] tracking-[0.14em] ${
              channel.status === "CRITICAL" ? "text-alert" : channel.status === "WARNING" ? "text-signal" : "text-haze"
            }`}
          >
            {channel.status}
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 px-1 pb-1 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#263449" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" hide />
            <YAxis
              domain={[channel.chartMin, channel.chartMax]}
              allowDataOverflow
              width={40}
              tickCount={4}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
            />
            {channel.warning !== null ? (
              <ReferenceLine y={channel.warning} stroke="#F5B942" strokeDasharray="4 3" strokeWidth={1} />
            ) : null}
            {channel.critical !== null ? (
              <ReferenceLine y={channel.critical} stroke="#EF4444" strokeDasharray="4 3" strokeWidth={1} />
            ) : null}
            <Tooltip
              isAnimationActive={false}
              contentStyle={{
                backgroundColor: "#0B1120",
                border: "1px solid #263449",
                borderRadius: 0,
                padding: "6px 8px",
              }}
              labelStyle={{ color: "#94A3B8", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
              itemStyle={{ color: "#E8EDF5", fontSize: 12, fontFamily: "JetBrains Mono, monospace", padding: 0 }}
              formatter={(value) => [
                typeof value === "number" ? value.toFixed(channel.decimals) : String(value ?? "—"),
                channel.unit,
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={1.6}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 3, fill: stroke, stroke: "#0B1120" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

import type { MissionStatus as Status } from "../types";

const STYLES: Record<Status, string> = {
  NOMINAL: "bg-olive text-ink",
  WARNING: "bg-signal text-navy",
  CRITICAL: "bg-alert text-white",
};

export function MissionStatus({ status }: { status: Status }) {
  return (
    <div className={`flex h-12 w-[148px] shrink-0 flex-col items-center justify-center ${STYLES[status]}`}>
      <span className="text-[9px] font-medium tracking-[0.22em]">MISSION STATUS</span>
      <span className="text-[15px] font-semibold tracking-[0.18em]">{status}</span>
    </div>
  );
}

import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({ title, aside, children, className, bodyClassName }: PanelProps) {
  return (
    <section className={`flex min-h-0 flex-col overflow-hidden border border-steel bg-panel ${className ?? ""}`}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-steel px-3 py-1.5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-haze">{title}</h2>
        {aside ? <div className="text-[10px] tracking-[0.12em] text-haze">{aside}</div> : null}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClassName ?? ""}`}>{children}</div>
    </section>
  );
}

import { SCENARIOS, type ScenarioId } from "../types";

interface ScenarioControlsProps {
  active: ScenarioId;
  error: string | null;
  onSelect: (scenario: ScenarioId) => void;
}

export function ScenarioControls({ active, error, onSelect }: ScenarioControlsProps) {
  const current = SCENARIOS.find((scenario) => scenario.id === active) ?? SCENARIOS[0];

  return (
    <footer className="shrink-0 border-t border-steel bg-panel">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <div className="mr-2">
          <div className="text-[9px] font-medium tracking-[0.18em] text-haze">SCENARIO CONTROLS</div>
          <div className="max-w-md text-[11px] text-haze">{error ?? current.detail}</div>
        </div>
        <div className="flex flex-wrap gap-2 md:ml-auto">
          {SCENARIOS.map((scenario) => {
            const pressed = scenario.id === active;
            const fault = scenario.id !== "normal";
            return (
              <button
                key={scenario.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => onSelect(scenario.id)}
                className={`h-9 border px-3 text-[11px] font-medium uppercase tracking-[0.14em] focus-visible:outline focus-visible:outline-1 focus-visible:outline-signal ${
                  pressed
                    ? fault
                      ? "border-signal bg-navy text-ink"
                      : "border-olive bg-navy text-ink"
                    : "border-steel bg-transparent text-haze hover:border-haze hover:text-ink"
                }`}
              >
                {scenario.label}
              </button>
            );
          })}
        </div>
      </div>
    </footer>
  );
}

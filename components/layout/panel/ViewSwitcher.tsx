"use client";

import type { View } from "./context-data";

export function ViewSwitcher({
  view,
  views,
  onChange,
}: {
  view: View;
  views: { id: View; label: string }[];
  onChange: (v: View) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Vues du panneau"
      className="flex flex-wrap items-center gap-1.5"
    >
      {views.map((t) => {
        const active = view === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(t.id)}
            className="ui-chip transition-colors duration-150"
          >
            <span className="block truncate">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

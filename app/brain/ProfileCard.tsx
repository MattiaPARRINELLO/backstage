"use client";

import type { MemoryData } from "@/lib/types";

export function ProfileCard({ profile }: { profile: MemoryData["profile"] }) {
  return (
    <div className="mb-8 border-b border-[var(--line)] pb-5">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--surface-2)] font-display text-[length:var(--t-lead)] font-semibold text-[var(--accent)]">
          {profile.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="ui-label">Profil</p>
          <h2 className="mt-0.5 font-display text-[length:var(--t-lead)] font-semibold text-[var(--text-1)]">
            {profile.name}
          </h2>
          {profile.preferences.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {profile.preferences.map((p) => (
                <span key={p} className="ui-chip">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

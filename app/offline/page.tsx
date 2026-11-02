import type { Metadata } from "next";
import { RetryButton } from "./RetryButton";

export const metadata: Metadata = {
  title: "Hors-ligne — BACKSTAGE",
};

export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-5 pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm text-center">
        <p className="ui-mono text-[var(--text-3)]">BACKSTAGE</p>
        <h1 className="mt-3 font-display text-[28px] font-semibold leading-[1.06] tracking-[-0.03em] text-[var(--text-1)]">
          Hors-ligne
        </h1>
        <p className="mt-3 text-[var(--t-body)] leading-relaxed text-[var(--text-2)]">
          Les données en cache sont toujours accessibles. Reviens dès que la connexion est rétablie.
        </p>
        <RetryButton />
      </div>
    </div>
  );
}

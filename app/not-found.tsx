import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Page introuvable — BACKSTAGE",
};

export default function NotFound() {
  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-5 pb-24 pt-20 sm:px-6">
          <p className="ui-mono text-[var(--text-3)]">Erreur 404</p>
          <h1 className="mt-3 font-display text-[length:var(--t-head)] font-semibold leading-[1.06] tracking-[-0.03em] text-[var(--text-1)]">
            Cette page n&apos;existe pas.
          </h1>
          <p className="mt-3 text-[length:var(--t-body)] leading-relaxed text-[var(--text-2)]">
            Le lien est peut-être périmé, ou la page a été déplacée.
          </p>
          <Link href="/chat" className="ui-btn ui-btn--primary mt-6 w-fit">
            Retour à la console
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { listInstalledModules } from "@/app/actions/modules";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@backstage/module-kit";

import { ModulesList } from "../ModulesList";

/**
 * Page de gestion des modules (issue #270).
 *
 * Rendue a la demande : l'etat vient du registre en cours et du disque, jamais
 * d'un cache de build. Le catalogue est une lecture reseau : s'il est
 * injoignable, la page reste utilisable en saisie manuelle.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Modules",
};

export default async function ModulesSettingsPage() {
  const state = await listInstalledModules();

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
          <Link
            href="/settings"
            className="text-[var(--t-small)] text-[var(--text-3)] hover:text-[var(--text-1)]"
          >
            Parametres
          </Link>
          <div className="mt-4">
            <PageHeader
              title="Modules"
              description="Voir quels modules le serveur sert vraiment, en activer, en ajouter depuis un depot git ou en retirer."
            />
          </div>

          <ModulesList state={state} />
        </div>
      </div>
    </AppShell>
  );
}

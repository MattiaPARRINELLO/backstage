import { createElement } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ModuleActionsProvider } from "@backstage/module-kit";

import { AppShell } from "@/components/layout/AppShell";
import { modulePage, modulePageTitle } from "@/lib/kernel/module-page";
import { registry } from "@/lib/kernel/registry";

import { callModuleAction } from "../actions";

/**
 * Route unique des pages de module (ADR 0001, decision G).
 *
 * Elle est ecrite une fois : ajouter une capacite ne la modifie pas. Le module
 * declare son slot `page` dans son manifeste, le noyau fournit la coquille.
 * Un module absent, desactive, ou sans page repond 404.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string }>;
}): Promise<Metadata> {
  const { module: id } = await params;
  const title = modulePageTitle(registry, id);
  return {
    title: title ? `${title} — BACKSTAGE` : "Module — BACKSTAGE",
    robots: { index: false, follow: false },
  };
}

export default async function ModuleRoute({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: id } = await params;
  const Page = modulePage(registry, id);
  if (!Page) notFound();

  return (
    <AppShell>
      <ModuleActionsProvider moduleId={id} call={callModuleAction}>
        {createElement(Page)}
      </ModuleActionsProvider>
    </AppShell>
  );
}

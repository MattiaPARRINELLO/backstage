"use client";

// ============================================================
// Entrees de rail des modules actifs.
//
// Le chrome est un composant client : il ne peut pas importer le
// registre. Le noyau rend les icones en SVG et les sert par
// `/api/modules/rail`, mis en cache cote client. Un module desactive
// disparait donc du rail sans rebuild de code.
// ============================================================

import { useMemo } from "react";
import { api, type GoogleLinkStatus, type ModuleRailEntry } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";
import type { NavItem } from "./nav-items";

export const GOOGLE_STATUS_KEY = "google:status";
export const MODULE_RAIL_KEY = "modules:rail";

export async function fetchGoogleStatus(): Promise<GoogleLinkStatus> {
  return api.googleStatus();
}

async function fetchModuleRail(): Promise<ModuleRailEntry[]> {
  const { items } = await api.moduleRail();
  return items;
}

export function useModuleNavItems(): NavItem[] {
  const { data } = useCachedFetch<ModuleRailEntry[]>(MODULE_RAIL_KEY, fetchModuleRail, {
    ttl: 5 * 60 * 1000,
  });
  return useMemo(
    () => (data ?? []).map((item) => ({ href: item.href, label: item.label, iconHtml: item.icon })),
    [data]
  );
}

import { NextResponse } from "next/server";

import { moduleRailItems } from "@/lib/kernel/module-nav";
import { renderRailIcon } from "@/lib/kernel/rail-markup";
import { registry } from "@/lib/kernel/registry";

/**
 * Navigation declaree par les modules actifs.
 *
 * L'icone est un composant React fourni par le module : le noyau la rend en SVG
 * statique pour que le chrome (composant client) n'importe jamais un module.
 * Le rendu n'execute que du code de confiance, comme le reste du manifeste.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const items = moduleRailItems(registry).map((item) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    icon: renderRailIcon(item.icon),
  }));

  return NextResponse.json({ items });
}

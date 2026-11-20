"use client";

// ============================================================
// Rendu d'une icone de navigation.
// Soit le SVG fourni par le noyau (module), soit l'icone lucide.
// ============================================================

import type { NavItem } from "./nav-items";

export function NavGlyph({ item, className }: { item: NavItem; className: string }) {
  if (item.iconHtml) {
    return (
      <span
        aria-hidden
        className={`${className} inline-flex [&>svg]:h-full [&>svg]:w-full`}
        dangerouslySetInnerHTML={{ __html: item.iconHtml }}
      />
    );
  }
  const Icon = item.icon;
  return Icon ? <Icon className={className} strokeWidth={1.6} /> : null;
}

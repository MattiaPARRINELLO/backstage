// ============================================================
// Destinations de navigation du chrome.
// Aucun etat : seulement la liste des pages coeur et la regle qui
// decide si une destination est active.
// ============================================================

import {
  Brain,
  MessageSquareText,
  Bell,
  Mail,
  CalendarRange,
  CalendarClock,
  CalendarDays,
  Timer,
  Camera,
  Search,
  Activity,
  Code2,
  Terminal,
  Images,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon?: typeof MessageSquareText;
  /** Icone deja rendue par le noyau (slot `rail` d'un module). */
  iconHtml?: string;
  exact?: boolean;
};

const navItems: NavItem[] = [
  { href: "/chat", label: "Console IA", icon: MessageSquareText, exact: true },
  { href: "/brain", label: "Cerveau", icon: Brain },
  { href: "/reminders", label: "Rappels", icon: Bell },
  { href: "/week", label: "Semaine", icon: CalendarDays },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/photos", label: "Photos", icon: Camera },
  { href: "/schedule", label: "Emploi du temps", icon: CalendarClock },
  { href: "/calendar", label: "Calendrier", icon: CalendarRange },
  { href: "/gmail", label: "Gmail", icon: Mail },
  { href: "/search", label: "Recherche", icon: Search },
  { href: "/activity", label: "Activité", icon: Activity },
  { href: "/demo-calls", label: "Journal démo", icon: Terminal },
  { href: "/leetcode", label: "LeetCode", icon: Code2 },
  { href: "/gallery", label: "Galerie", icon: Images },
];

// Navigation principale : les destinations coeur du produit, puis les entrees
// declarees par les modules actifs (slot `rail`). Le reste est accessible via le
// menu « Plus » (rail desktop et bottom nav mobile).
export const primaryNavItems: NavItem[] = [
  { href: "/chat", label: "Console IA", icon: MessageSquareText, exact: true },
  { href: "/today", label: "Aujourd'hui", icon: CalendarDays, exact: true },
  { href: "/brain", label: "Cerveau", icon: Brain },
];

export const secondaryNavItems: NavItem[] = navItems
  .filter((item) => !primaryNavItems.some((p) => p.href === item.href))
  // La galerie est integree a la page Photos (vue « Livraison »).
  .filter((item) => item.href !== "/gallery");

export const mobileNavItems: NavItem[] = primaryNavItems;
export const mobileMoreItems: NavItem[] = secondaryNavItems;

/** Vrai si `pathname` designe cette destination (exacte ou sous-route). */
export function isItemActive(pathname: string, item: NavItem): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

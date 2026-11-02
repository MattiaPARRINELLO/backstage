"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import {
  Brain,
  MessageSquareText,
  Bell,
  Bookmark,
  LogOut,
  Mail,
  CalendarRange,
  CalendarClock,
  CalendarDays,
  Timer,
  Check,
  X as XIcon,
  Camera,
  Settings,
  Search,
  Activity,
  Code2,
  Terminal,
  Images,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, type GoogleLinkStatus } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";

type NavItem = {
  href: string;
  label: string;
  icon: typeof MessageSquareText;
  exact?: boolean;
};

const navItems: NavItem[] = [
  { href: "/chat", label: "Console IA", icon: MessageSquareText, exact: true },
  { href: "/brain", label: "Cerveau", icon: Brain },
  { href: "/reminders", label: "Rappels", icon: Bell },
  { href: "/week", label: "Semaine", icon: CalendarDays },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/watch-later", label: "À voir", icon: Bookmark },
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

// Navigation principale : les 4 destinations cœur du produit. Le reste est
// accessible via le menu « Plus » (rail desktop et bottom nav mobile).
const primaryNavItems: NavItem[] = [
  { href: "/chat", label: "Console IA", icon: MessageSquareText, exact: true },
  { href: "/today", label: "Aujourd'hui", icon: CalendarDays, exact: true },
  { href: "/brain", label: "Cerveau", icon: Brain },
  { href: "/watch-later", label: "À voir", icon: Bookmark },
];

const secondaryNavItems: NavItem[] = navItems
  .filter((item) => !primaryNavItems.some((p) => p.href === item.href))
  // La galerie est intégrée à la page Photos (vue « Livraison »).
  .filter((item) => item.href !== "/gallery");

const mobileNavItems: NavItem[] = primaryNavItems;
const mobileMoreItems: NavItem[] = secondaryNavItems;

const GOOGLE_STATUS_KEY = "google:status";

async function fetchGoogleStatus(): Promise<GoogleLinkStatus> {
  return api.googleStatus();
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  // Purge des caches privés : cache du service worker (pages pré-rendues et
  // réponses GET mises en cache) + cache localStorage des API. Sans cette
  // purge, des données personnelles restent lisibles après déconnexion.
  const registration = await navigator.serviceWorker?.getRegistration();
  registration?.active?.postMessage({ type: "CLEAR_CACHE" });
  const { clearOfflineCache } = await import("@/lib/offline");
  clearOfflineCache();
}

export function LeftNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  return (
    <aside aria-label="Navigation" className="hidden lg:flex flex-col w-[72px] shrink-0 h-full bg-transparent" style={{ viewTransitionName: "sidebar" }}>
      <div className="flex items-center justify-center h-16">
        <Image
          src="/backstage-logo-simple.png"
          alt="BACKSTAGE"
          width={40}
          height={40}
          className="w-10 h-10 object-contain"
        />
      </div>

      <nav className="flex-1 flex flex-col items-center gap-1.5 py-3 overflow-y-auto min-h-0">
        {primaryNavItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "group relative w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-150",
                active
                  ? "bg-[var(--accent)]/12 text-[var(--accent)]"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]"
              )}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={1.6} />
              <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1 rounded-[var(--r-sm)] bg-[var(--surface-3)] border border-[var(--line)] text-[length:var(--t-small)] text-[var(--text-1)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("backstage:open-more"))}
          title="Toutes les pages"
          aria-label="Toutes les pages"
          className={cn(
            "group relative w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-150",
            !primaryNavItems.some((p) => p.exact ? pathname === p.href : pathname === p.href || pathname.startsWith(`${p.href}/`))
              ? "bg-[var(--accent)]/12 text-[var(--accent)]"
              : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]"
          )}
        >
          <MoreHorizontal className="w-[18px] h-[18px]" strokeWidth={1.6} />
          <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1 rounded-[var(--r-sm)] bg-[var(--surface-3)] border border-[var(--line)] text-[length:var(--t-small)] text-[var(--text-1)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
            Toutes les pages
          </span>
        </button>
      </nav>

      <div className="flex flex-col items-center gap-1.5 py-4">
        <Link
          href="/settings"
          title="Paramètres"
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-150",
            pathname === "/settings"
              ? "bg-[var(--accent)]/12 text-[var(--accent)]"
              : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]"
          )}
        >
          <Settings className="w-4 h-4" />
        </Link>
        <button
          onClick={handleLogout}
          title="Déconnexion"
          aria-label="Déconnexion"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors duration-150"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  const openPalette = () => {
    window.dispatchEvent(new CustomEvent("backstage:open-palette"));
  };

  return (
    <div className="lg:hidden shrink-0 pt-[env(safe-area-inset-top)] bg-[var(--background)]">
      <div className="flex items-center justify-between h-14 px-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[var(--surface-2)] flex items-center justify-center overflow-hidden shrink-0">
            <Image
              src="/backstage-logo-simple.png"
              alt="BACKSTAGE"
              width={24}
              height={24}
              className="w-4 h-4 object-contain"
            />
          </div>
          <span className="font-display font-semibold tracking-[-0.03em] text-[length:var(--t-body)] text-[var(--text-1)] truncate">BACKSTAGE</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={openPalette}
            className="w-10 h-10 -mr-1 rounded-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
            title="Palette de commandes"
            aria-label="Palette de commandes"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>
          <Link
            href="/settings"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
            title="Paramètres"
            aria-label="Paramètres"
          >
            <Settings className="w-[18px] h-[18px]" />
          </Link>
          <GoogleMobileStatus />
        </div>
      </div>
    </div>
  );
}

function GoogleMobileStatus() {
  const { data: status } = useCachedFetch<GoogleLinkStatus>(
    GOOGLE_STATUS_KEY,
    fetchGoogleStatus,
    { ttl: 60 * 1000 }
  );
  if (!status) return null;
  return (
    <div className="flex items-center gap-0.5">
      {status.gmail && status.calendar ? (
        <a
          href="/api/auth/google?type=gmail"
          className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--success)]/10 text-[var(--success)]"
          title="Gmail + Calendrier liés"
        >
          <Check className="w-4 h-4" />
        </a>
      ) : (
        <>
          <a
            href="/api/auth/google?type=gmail"
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
              status.gmail
                ? "bg-[var(--success)]/10 text-[var(--success)]"
                : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]"
            )}
            title={status.gmail ? "Gmail lié" : "Lier Gmail"}
          >
            {status.gmail ? <Check className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
          </a>
          <a
            href="/api/auth/google?type=calendar"
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
              status.calendar
                ? "bg-[var(--success)]/10 text-[var(--success)]"
                : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]"
            )}
            title={status.calendar ? "Calendrier lié" : "Lier Calendrier"}
          >
            {status.calendar ? <Check className="w-4 h-4" /> : <CalendarRange className="w-4 h-4" />}
          </a>
        </>
      )}
    </div>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Le rail desktop et la bottom nav mobile ouvrent le même sheet via cet
  // événement : les pages secondaires restent accessibles partout.
  useEffect(() => {
    const openMore = () => setMoreOpen(true);
    window.addEventListener("backstage:open-more", openMore);
    return () => window.removeEventListener("backstage:open-more", openMore);
  }, []);

  const coreActive = mobileNavItems.some(
    (item) =>
      item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return (
    <>
      <nav className="lg:hidden flex items-stretch h-16 bg-[var(--background)] px-1 pb-[env(safe-area-inset-bottom)] shrink-0">
        {mobileNavItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 min-w-0 transition-colors duration-150",
                active ? "text-[var(--accent)]" : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={1.6} />
              <span className="text-[length:var(--t-small)] truncate max-w-full px-0.5">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center gap-1 flex-1 min-w-0 transition-colors duration-150",
            !coreActive ? "text-[var(--accent)]" : "text-[var(--text-3)] hover:text-[var(--text-1)]"
          )}
          aria-label="Plus d'options"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal className="w-5 h-5" strokeWidth={1.6} />
          <span className="text-[length:var(--t-small)]">Plus</span>
        </button>
      </nav>
      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}

function MobileMoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  if (!open) return null;

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-[var(--background)]/70" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[82vh] rounded-t-[var(--r-card)] bg-[var(--surface-1)] shadow-[var(--shadow-float)] flex flex-col pb-[env(safe-area-inset-bottom)] fade-in-up">
        <div className="flex items-center justify-between h-14 px-4 shrink-0">
          <span className="ui-mono text-[var(--text-3)]">
            Toutes les pages
          </span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1">
          {mobileMoreItems.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 mx-2 px-3 min-h-12 rounded-[var(--r-sm)] text-[length:var(--t-body)] transition-colors duration-150",
                  active
                    ? "text-[var(--text-1)] bg-[var(--surface-2)]"
                    : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]"
                )}
              >
                <Icon className="w-4 h-4 shrink-0 text-[var(--text-3)]" strokeWidth={1.6} />
                <span className="truncate">{item.label}</span>
                {active && <Check className="w-3.5 h-3.5 ml-auto shrink-0 text-[var(--accent)]" />}
              </Link>
            );
          })}
        </div>
        <div className="shrink-0 py-2">
          <Link
            href="/settings"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 mx-2 px-3 min-h-12 rounded-[var(--r-sm)] text-[length:var(--t-body)] transition-colors duration-150",
              pathname === "/settings"
                ? "text-[var(--text-1)] bg-[var(--surface-2)]"
                : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]"
            )}
          >
            <Settings className="w-4 h-4 shrink-0 text-[var(--text-3)]" strokeWidth={1.6} />
            <span>Paramètres</span>
            {pathname === "/settings" && <Check className="w-3.5 h-3.5 ml-auto shrink-0 text-[var(--accent)]" />}
          </Link>
          <button
            onClick={handleLogout}
            className="w-[calc(100%-1rem)] mx-2 flex items-center gap-3 px-3 min-h-12 rounded-[var(--r-sm)] text-[length:var(--t-body)] text-[var(--danger)] hover:bg-[var(--danger)]/8 transition-colors duration-150"
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.6} />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 mb-8">
      <div className="min-w-0">
        {eyebrow && (
          <p className="ui-mono text-[var(--text-3)] mb-2">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display font-semibold tracking-[-0.03em] text-[length:var(--t-head)] leading-[1.02] text-[var(--text-1)] text-balance">
          {title}
        </h1>
        {description && (
          <p className="text-[length:var(--t-body)] text-[var(--text-2)] mt-3 max-w-[34rem] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      {icon && (
        <div className="mb-4 text-[var(--text-3)]">
          {icon}
        </div>
      )}
      <h3 className="font-display font-semibold tracking-[-0.03em] text-[length:var(--t-lead)] text-[var(--text-1)] mb-1.5">{title}</h3>
      {description && (
        <p className="text-[length:var(--t-small)] text-[var(--text-3)] max-w-[28rem] leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function CloseButton({ onClick, label = "Fermer" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
    >
      <XIcon className="w-3.5 h-3.5" />
    </button>
  );
}

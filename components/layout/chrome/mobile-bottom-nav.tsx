"use client";

// ============================================================
// Navigation mobile basse et feuille « Toutes les pages ».
// Le rail desktop ouvre la meme feuille par l'evenement
// `backstage:open-more`.
// ============================================================

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, LogOut, Settings, MoreHorizontal, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isItemActive, mobileMoreItems, mobileNavItems } from "./nav-items";
import { useModuleNavItems } from "./use-module-nav-items";
import { NavGlyph } from "./nav-glyph";
import { logout } from "./logout";

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moduleItems = useModuleNavItems();
  const items = [...mobileNavItems, ...moduleItems];

  // Le rail desktop et la bottom nav mobile ouvrent le meme sheet via cet
  // evenement : les pages secondaires restent accessibles partout.
  useEffect(() => {
    const openMore = () => setMoreOpen(true);
    window.addEventListener("backstage:open-more", openMore);
    return () => window.removeEventListener("backstage:open-more", openMore);
  }, []);

  const coreActive = items.some((item) => isItemActive(pathname, item));

  return (
    <>
      <nav className="lg:hidden flex items-stretch h-16 bg-[var(--background)] px-1 pb-[env(safe-area-inset-bottom)] shrink-0">
        {items.map((item) => {
          const active = isItemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 min-w-0 transition-colors duration-150",
                active ? "text-[var(--accent)]" : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              )}
            >
              <NavGlyph item={item} className="w-5 h-5" />
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
            const active = isItemActive(pathname, item);
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
                <span className="w-4 h-4 shrink-0 text-[var(--text-3)]">
                  <NavGlyph item={item} className="w-4 h-4" />
                </span>
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

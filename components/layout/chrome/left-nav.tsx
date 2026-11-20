"use client";

// ============================================================
// Rail desktop : destinations coeur, entrees de modules, puis
// parametres et deconnexion en bas.
// ============================================================

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { isItemActive, primaryNavItems } from "./nav-items";
import { useModuleNavItems } from "./use-module-nav-items";
import { NavGlyph } from "./nav-glyph";
import { logout } from "./logout";

export function LeftNav() {
  const pathname = usePathname();
  const router = useRouter();
  const moduleItems = useModuleNavItems();
  const primaryItems = [...primaryNavItems, ...moduleItems];

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
        {primaryItems.map((item) => {
          const active = isItemActive(pathname, item);
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
              <NavGlyph item={item} className="w-[18px] h-[18px]" />
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
            !primaryItems.some((p) => isItemActive(pathname, p))
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

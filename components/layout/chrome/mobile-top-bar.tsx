"use client";

// ============================================================
// Barre mobile haute : logo, palette, parametres, etat Google.
// ============================================================

import Link from "next/link";
import Image from "next/image";
import { Search, Settings, Check, Mail, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoogleLinkStatus } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";
import { GOOGLE_STATUS_KEY, fetchGoogleStatus } from "./use-module-nav-items";

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

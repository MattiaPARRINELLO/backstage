"use client";

import { BellRing, BellOff, Bell } from "lucide-react";
import type { NotificationPermissionState } from "@/lib/notifications";

export function PermissionPill({
  permission,
  onRequest,
}: {
  permission: NotificationPermissionState;
  onRequest: () => void;
}) {
  if (permission === "granted") {
    return (
      <span className="ui-chip">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" aria-hidden />
        <BellRing className="w-3.5 h-3.5 text-[var(--text-3)]" strokeWidth={1.5} />
        <span className="hidden sm:inline">Notifications actives</span>
      </span>
    );
  }
  if (permission === "denied") {
    return (
      <span className="ui-chip">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" aria-hidden />
        <BellOff className="w-3.5 h-3.5 text-[var(--text-3)]" strokeWidth={1.5} />
        <span className="hidden sm:inline">Notifications refusées</span>
      </span>
    );
  }
  if (permission === "unsupported") return null;
  return (
    <button onClick={onRequest} className="ui-chip">
      <Bell className="w-3.5 h-3.5 text-[var(--text-3)]" strokeWidth={1.5} />
      <span className="hidden sm:inline">Activer les notifications</span>
    </button>
  );
}

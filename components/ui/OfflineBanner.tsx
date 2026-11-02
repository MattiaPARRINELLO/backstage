"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const [online, setOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const [show, setShow] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      setShow(true);
      setTimeout(() => setShow(false), 3000);
    }
    function handleOffline() {
      setOnline(false);
      setShow(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={cn(
        "fixed left-1/2 -translate-x-1/2 z-[90] px-4 py-2.5 rounded-[var(--r-tile)] border text-[length:var(--t-small)] ui-mono transition-colors duration-500",
        "bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] lg:bottom-4",
        online
          ? "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]"
          : "border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]"
      )}
      style={{
        animation: show ? "slide-up 280ms ease-out" : "fade-out 300ms ease-in forwards",
      }}
    >
      {online ? "Connecté" : "Mode hors-ligne — les données sont en cache"}
    </div>
  );
}

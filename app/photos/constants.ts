import type { PhotoShootStatus } from "@/lib/types";

export const STATUS_FLOW: { key: PhotoShootStatus; label: string }[] = [
  { key: "upcoming", label: "À venir" },
  { key: "done", label: "Fait" },
  { key: "on_pc", label: "Sur PC" },
  { key: "sorted", label: "Trié" },
  { key: "edited", label: "Retouché" },
  { key: "exported", label: "Exporté" },
  { key: "sent", label: "Envoyé" },
];

export const STATUS_ORDER: PhotoShootStatus[] = [
  "upcoming", "done", "on_pc", "sorted", "edited", "exported", "sent",
];

export function statusIndex(s: PhotoShootStatus): number {
  return STATUS_ORDER.indexOf(s);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/** Jour et mois séparés pour la vignette carrée d'une carte. */
export function thumbParts(dateStr: string): { day: string; month: string } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: d.toLocaleDateString("fr-FR", { day: "2-digit" }),
    month: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
  };
}

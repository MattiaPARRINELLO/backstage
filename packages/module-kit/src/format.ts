/**
 * Formatage de dates pour l'interface d'un module.
 *
 * Vit dans le kit pour qu'une page de module n'importe pas `lib/` (ADR 0001,
 * decision G). `lib/date.ts` le re-exporte : une seule implementation.
 */
export function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diff = (date.getTime() - now) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400 / 7), "week");
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

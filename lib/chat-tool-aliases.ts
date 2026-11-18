/**
 * Noms d'outils d'avant le registre de modules.
 *
 * Le 2026-11-17, quatre outils sont passés du noyau à un module :
 * `add_reminder` → `reminders.add`, etc., et `get_schedule` → `schedule.get`. Le modèle utilise désormais les noms
 * qualifiés, mais l'historique de conversation déjà enregistré porte les
 * anciens. Cette table traduit **en lecture seulement** : elle sert aux cartes
 * d'outil, à la détection de contenu non fiable et au registre, jamais à
 * envoyer un ancien nom au modèle.
 *
 * Elle pourra disparaître quand plus aucun historique ne contiendra ces noms.
 * En attendant, l'oublier dans un seul des points de lecture rendrait un ancien
 * tour soit illisible, soit non contrôlé.
 */
export const LEGACY_TOOL_NAMES: Readonly<Record<string, string>> = {
  add_reminder: "reminders.add",
  list_reminders: "reminders.list",
  update_reminder: "reminders.update",
  get_schedule: "schedule.get",
  add_watch_later: "watch-later.add",
  get_weather: "weather.get",
  create_github_issue: "github.create_issue",
  list_github_issues: "github.list_issues",
  web_search: "web.search",
  fetch_page_meta: "web.page_meta",
  schedule_followup: "followups.schedule",
  lookup_concerts: "concerts.list",
  prepare_concert: "concerts.prepare",
  create_calendar_event: "calendar.create",
  update_calendar_event: "calendar.update",
  delete_calendar_event: "calendar.delete",
  search_calendar_events: "calendar.search",
};

/** Nom courant d'un outil, à partir d'un nom ancien ou déjà qualifié. */
export function normalizeToolName(name: string): string {
  return LEGACY_TOOL_NAMES[name] ?? name;
}

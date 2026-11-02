"use client";

import { useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, type CalendarEvent } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/date";
import {
  EVENT_COLORS,
  MONTHS,
  DAYS,
  isAllDay,
  isSpanningOrAllDay,
  visibleSpan,
  layoutMultiDayLanes,
  monthWeeks,
  toDatetimeLocal,
  monthRangeKey,
} from "./calendar-utils";

export default function CalendarPage() {
  const [today] = useState(() => new Date());
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const { timeMin, timeMax, cacheKey } = monthRangeKey(year, month);

  const fetchCalendarEvents = useCallback(async (): Promise<CalendarEvent[]> => {
    const res = await api.calendar.list(timeMin, timeMax);
    if (res.error) throw new Error(res.error);
    return res.events ?? [];
  }, [timeMin, timeMax]);

  const {
    data: events,
    loading,
    error,
    refetch: fetchEvents,
  } = useCachedFetch<CalendarEvent[]>(cacheKey, fetchCalendarEvents, {
    ttl: 2 * 60 * 1000,
  });

  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState({ summary: "", description: "", location: "", colorId: "" });
  const [saving, setSaving] = useState(false);

  const weeks = monthWeeks(year, month);
  const todayStr = today.toDateString();

  function timedEventsForDay(day: number): CalendarEvent[] {
    const dateStr = new Date(year, month, day).toDateString();
    return (events ?? []).filter((e) => {
      if (isSpanningOrAllDay(e)) return false;
      return new Date(e.start).toDateString() === dateStr;
    });
  }

  function multiDayEventsForWeek(weekStart: Date): CalendarEvent[] {
    return (events ?? []).filter((e) => isSpanningOrAllDay(e)).filter((e) => {
      const span = visibleSpan(e, weekStart);
      return span !== null;
    });
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  function openEdit(evt: CalendarEvent) {
    setIsCreating(false);
    setEditing(evt);
    setEditForm({
      summary: evt.summary,
      description: evt.description ?? "",
      location: evt.location ?? "",
      colorId: evt.colorId ?? "",
    });
  }

  function createNewEvent(day?: number) {
    const start = new Date(year, month, day ?? today.getDate(), 10, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    setIsCreating(true);
    setEditing({
      id: "",
      summary: "",
      description: "",
      location: "",
      start: start.toISOString(),
      end: end.toISOString(),
    });
    setEditForm({ summary: "", description: "", location: "", colorId: "" });
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      if (isCreating) {
        await api.calendar.create({
          summary: editForm.summary || "(Sans titre)",
          start: editing.start,
          end: editing.end,
          description: editForm.description,
          location: editForm.location,
        });
      } else {
        await api.calendar.update(editing.id, editForm);
      }
      setEditing(null);
      setIsCreating(false);
      await fetchEvents();
    } catch (err) {
      console.error("Save error", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <PageHeader
            title="Calendrier"
            description="Vue mensuelle de tes événements synchronisés."
            actions={
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => createNewEvent()}
                  className="ui-btn ui-btn--primary"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                  Nouvel événement
                </button>
                <a
                  href="/api/auth/google?type=calendar"
                  className="ui-btn ui-btn--text"
                >
                  <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                  Ouvrir dans Google
                </a>
              </div>
            }
          />

          {error && (
            <div className="mb-6 rounded-[var(--r-sm)] border-l-2 border-[var(--danger)] bg-[var(--danger)]/8 px-3 py-2 text-[length:var(--t-small)] text-[var(--danger)]">
              {error.message}
            </div>
          )}

          <div className="ui-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
              <button
                onClick={prevMonth}
                aria-label="Mois précédent"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <h2 className="font-display text-[length:var(--t-lead)] font-semibold tracking-[-0.03em] text-[var(--text-1)]">
                {MONTHS[month]} {year}
              </h2>
              <button
                onClick={nextMonth}
                aria-label="Mois suivant"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {loading && !events && (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}

            {events && (
              <div>
                <div className="grid grid-cols-7 border-b border-[var(--line)]">
                  {DAYS.map((d) => (
                    <div
                      key={d}
                      className="ui-mono px-2 py-2 text-center text-[var(--text-3)]"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                <div>
                  {weeks.map(({ days, start: weekStart }, wi) => {
                    const spanningEvents = multiDayEventsForWeek(weekStart);
                    return (
                      <div key={wi} className="border-b border-[var(--line)] last:border-b-0">
                        {spanningEvents.length > 0 && (
                          <div
                            className="grid grid-cols-7 border-b border-[var(--line)]"
                            style={{ gridAutoRows: "24px" }}
                          >
                            {layoutMultiDayLanes(spanningEvents, weekStart).map((lane, li) =>
                              lane.map((evt) => {
                                const span = visibleSpan(evt, weekStart);
                                if (!span) return null;
                                return (
                                  <button
                                    key={evt.id}
                                    onClick={() => openEdit(evt)}
                                    className="m-0.5 truncate rounded-[6px] bg-[var(--accent-soft)]/20 px-1.5 text-left text-[length:var(--t-small)] font-medium text-[var(--text-1)] transition-colors hover:bg-[var(--accent-soft)]/30"
                                    style={{
                                      gridColumn: `${span.startCol + 1} / ${span.endCol + 2}`,
                                      gridRow: li + 1,
                                    }}
                                  >
                                    {evt.summary}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-7">
                          {days.map((day, di) => {
                            const dayEvents = day ? timedEventsForDay(day) : [];
                            const isToday = day !== null && new Date(year, month, day).toDateString() === todayStr;
                            return (
                              <div
                                key={di}
                                onDoubleClick={() => day !== null && createNewEvent(day)}
                                className={cn(
                                  "min-h-[104px] border-r border-[var(--line)] p-1.5 transition-colors last:border-r-0",
                                  day === null ? "bg-[var(--surface-2)]/40" : "cursor-pointer hover:bg-[var(--surface-2)]/50"
                                )}
                              >
                                {day !== null && (
                                  <>
                                    <span
                                      className={cn(
                                        "ui-mono inline-flex h-5 w-5 items-center justify-center rounded-full",
                                        isToday
                                          ? "bg-[var(--accent)] font-medium text-[var(--background)]"
                                          : "text-[var(--text-3)]"
                                      )}
                                    >
                                      {day}
                                    </span>
                                    <div className="mt-1 space-y-0.5">
                                      {dayEvents.map((evt) => (
                                        <button
                                          key={evt.id}
                                          onClick={() => openEdit(evt)}
                                          className="block w-full truncate rounded-[6px] bg-[var(--accent-soft)]/20 px-1.5 py-0.5 text-left text-[length:var(--t-small)] text-[var(--text-1)] transition-colors hover:bg-[var(--accent-soft)]/30"
                                        >
                                          <span className="ui-mono mr-1 text-[var(--text-3)]">
                                            {formatTime(evt.start)}
                                          </span>
                                          {evt.summary}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {!loading && events?.length === 0 && (
            <div className="mt-6">
              <EmptyState
                title="Aucun événement"
                description="Ton calendrier est vide pour ce mois."
              />
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--background)]/70 py-4 backdrop-blur-sm sm:items-center">
          <div className="ui-card my-auto mx-4 flex max-h-[85vh] w-full max-w-lg flex-col shadow-[var(--shadow-float)]">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-6 py-4">
              <h3 className="font-display text-[length:var(--t-lead)] font-semibold tracking-[-0.03em] text-[var(--text-1)]">
                {isCreating ? "Nouvel événement" : "Modifier l'événement"}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-6">
              <label className="block">
                <span className="ui-label mb-1.5 block">Titre</span>
                <input
                  type="text"
                  className="ui-field w-full"
                  value={editForm.summary}
                  onChange={(e) => setEditForm((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="Titre de l'événement"
                />
              </label>

              {isCreating && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="ui-label mb-1.5 block">Début</span>
                    <input
                      type="datetime-local"
                      className="ui-field ui-mono w-full"
                      value={toDatetimeLocal(editing.start)}
                      onChange={(e) => setEditing((evt) => (evt ? { ...evt, start: new Date(e.target.value).toISOString() } : null))}
                    />
                  </label>
                  <label className="block">
                    <span className="ui-label mb-1.5 block">Fin</span>
                    <input
                      type="datetime-local"
                      className="ui-field ui-mono w-full"
                      value={toDatetimeLocal(editing.end)}
                      onChange={(e) => setEditing((evt) => (evt ? { ...evt, end: new Date(e.target.value).toISOString() } : null))}
                    />
                  </label>
                </div>
              )}

              <label className="block">
                <span className="ui-label mb-1.5 block">Lieu</span>
                <input
                  type="text"
                  className="ui-field w-full"
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Salle, lien, adresse…"
                />
              </label>

              <label className="block">
                <span className="ui-label mb-1.5 block">Description</span>
                <textarea
                  className="ui-field min-h-[88px] w-full resize-none items-start py-3"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </label>

              <div>
                <span className="ui-label mb-2 block">Couleur</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(EVENT_COLORS).map(([id, c]) => (
                    <button
                      key={id}
                      onClick={() => setEditForm((f) => ({ ...f, colorId: id }))}
                      title={c.name}
                      aria-label={c.name}
                      aria-pressed={editForm.colorId === id}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-colors duration-200",
                        editForm.colorId === id
                          ? "border-[var(--text-1)]"
                          : "border-transparent hover:border-[var(--line-2)]"
                      )}
                      style={{ backgroundColor: c.bg }}
                    />
                  ))}
                  <button
                    onClick={() => setEditForm((f) => ({ ...f, colorId: "" }))}
                    title="Aucune couleur"
                    aria-label="Aucune couleur"
                    aria-pressed={!editForm.colorId}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-[var(--text-3)] transition-colors duration-200",
                      !editForm.colorId
                        ? "border-[var(--text-1)]"
                        : "border-dashed border-[var(--line-2)] hover:border-[var(--text-3)]"
                    )}
                  >
                    <X className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {editing.start && (
                <div className="ui-mono flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4 text-[var(--text-3)]">
                  <span>{new Date(editing.start).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
                  {!isAllDay(editing) && (
                    <span>{formatTime(editing.start)} — {formatTime(editing.end)}</span>
                  )}
                  {isAllDay(editing) && <span>Journée entière</span>}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--line)] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={() => setEditing(null)}
                className="ui-btn ui-btn--ghost"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="ui-btn ui-btn--primary"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

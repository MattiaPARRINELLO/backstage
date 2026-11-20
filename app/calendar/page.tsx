"use client";

import { useState, useCallback } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { api, type CalendarEvent } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";
import { monthWeeks, monthRangeKey } from "./calendar-utils";
import { MonthGrid } from "./month-grid";
import { EventEditor, type EditForm } from "./event-editor";

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
  const [editForm, setEditForm] = useState<EditForm>({ summary: "", description: "", location: "", colorId: "" });
  const [saving, setSaving] = useState(false);

  const weeks = monthWeeks(year, month);
  const todayStr = today.toDateString();

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

          <MonthGrid
            year={year}
            month={month}
            weeks={weeks}
            events={events}
            loading={loading}
            todayStr={todayStr}
            onPrev={prevMonth}
            onNext={nextMonth}
            onOpenEdit={openEdit}
            onCreateOnDay={createNewEvent}
          />

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
        <EventEditor
          editing={editing}
          isCreating={isCreating}
          editForm={editForm}
          saving={saving}
          setEditForm={setEditForm}
          setEditing={setEditing}
          onSave={handleSave}
        />
      )}
    </AppShell>
  );
}

"use client";

import { useEffect, useState, useTransition, useRef, useMemo } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  loadReminders,
  createReminder,
  removeReminder,
  markReminderStatus,
  editReminder,
} from "@/app/actions/reminders";
import type { Reminder, ReminderRecurrence, ReminderStatus } from "@/lib/types";
import { api } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";
import { MicrosoftTodoPanel } from "@/components/MicrosoftTodoPanel";
import {
  fireBrowserNotification,
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermissionState,
} from "@/lib/notifications";
import { buildTimeline } from "./timeline";
import { PermissionPill } from "./PermissionPill";
import { ReminderRow } from "./ReminderRow";
import { ReminderForm } from "./ReminderForm";

const POLL_INTERVAL_MS = 15_000;

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const notifiedRef = useRef<Set<string>>(new Set());
  const toast = useToast();

  // État du lien Microsoft To Do : permet d'afficher les rappels non
  // synchronisés (sync échouée ou rappel créé avant la liaison).
  const { data: msStatus } = useCachedFetch<{ linked: boolean }>(
    "microsoft:status",
    () => api.microsoftStatus(),
    { ttl: 60 * 1000 }
  );
  const msLinked = msStatus?.linked === true;

  useEffect(() => {
    Promise.resolve().then(() => {
      startTransition(async () => {
        const d = await loadReminders();
        setReminders(d.reminders.sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)));
      });
    });
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => setPermission(getNotificationPermission()));
  }, []);

  useEffect(() => {
    if (permission !== "granted" || !reminders) return;
    const id = setInterval(() => {
      const now = Date.now();
      for (const r of reminders) {
        if (r.status !== "pending") continue;
        if (notifiedRef.current.has(r.id)) continue;
        if (new Date(r.dueAt).getTime() <= now) {
          fireBrowserNotification({
            title: `Rappel : ${r.title}`,
            body: r.notes || "Il est temps.",
            tag: r.id,
          });
          notifiedRef.current.add(r.id);
        }
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [permission, reminders]);

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
  };

  const handleCreate = (input: { title: string; notes?: string; dueAt: string; recurrence?: ReminderRecurrence }) => {
    startTransition(async () => {
      const r = await createReminder(input);
      setReminders((prev) => [...(prev ?? []), r].sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)));
      setShowAdd(false);
      toast.show({ message: "Rappel créé", tone: "success", duration: 2200 });
    });
  };

  const handleToggle = (r: Reminder) => {
    const next: ReminderStatus = r.status === "done" ? "pending" : "done";
    setReminders((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, status: next } : x)));
    void markReminderStatus(r.id, next);
    if (next === "done") {
      toast.show({ message: "Rappel terminé", tone: "success", duration: 1800 });
    }
  };

  const handleDelete = (id: string) => {
    if (!reminders) return;
    const r = reminders.find((x) => x.id === id);
    if (!r) return;
    setReminders((prev) => (prev ?? []).filter((x) => x.id !== id));
    const toastId = toast.show({
      message: `Rappel supprimé : "${r.title.slice(0, 50)}"`,
      tone: "default",
      duration: 5000,
      action: {
        label: "Annuler",
        onClick: () => {
          setReminders((prev) => (prev ? [...prev, r] : prev));
          void createReminder({ title: r.title, notes: r.notes, dueAt: r.dueAt, recurrence: r.recurrence }).then((restored) => {
            setReminders((prev) =>
              prev ? prev.map((x) => (x.id === id ? restored : x)) : prev
            );
            toast.dismiss(toastId);
            toast.show({ message: "Rappel restauré", tone: "success", duration: 2000 });
          });
        },
      },
    });
    void removeReminder(id);
  };

  const handleEdit = (id: string, input: { title: string; notes?: string; dueAt: string; recurrence?: ReminderRecurrence }) => {
    startTransition(async () => {
      const updated = await editReminder(id, input);
      if (updated) {
        setReminders((prev) =>
          (prev ?? []).map((x) => (x.id === id ? updated : x)).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
        );
        toast.show({ message: "Rappel mis à jour", tone: "success", duration: 2000 });
      }
      setEditing(null);
    });
  };

  const timeline = useMemo(() => buildTimeline(reminders ?? []), [reminders]);
  const completed = (reminders ?? []).filter((r) => r.status === "done");

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <PageHeader
            title="Rappels"
            description="Liste ce que tu dois faire."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <PermissionPill permission={permission} onRequest={handleRequestPermission} />
                <button
                  onClick={() => setShowAdd(true)}
                  className="ui-btn ui-btn--primary"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                  Nouveau rappel
                </button>
              </div>
            }
          />

          {showAdd && (
            <div className="mb-8">
              <ReminderForm
                onCancel={() => setShowAdd(false)}
                onSubmit={handleCreate}
              />
            </div>
          )}

          {permission === "unsupported" && (
            <p className="ui-label mb-6">
              Les notifications natives ne sont pas supportées sur ce navigateur.
            </p>
          )}

          {reminders === null ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : timeline.length === 0 && completed.length === 0 ? (
            <EmptyState
              title="Aucun rappel pour l'instant"
              description="Crée un rappel pour recevoir une notification à l'heure dite."
            />
          ) : (
            <div>
              <div className="space-y-10">
                {timeline.map((bucket) => (
                  <section key={bucket.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-[var(--line)] pb-2">
                      <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-1)] first-letter:uppercase">
                        {bucket.label}
                      </h2>
                      <span className="ui-mono text-[var(--text-3)]">
                        {bucket.items.length}
                      </span>
                    </div>
                    <ul className="divide-y divide-[var(--line)]">
                      {bucket.items.map((r) =>
                        editing === r.id ? (
                          <li key={r.id} className="py-3">
                            <ReminderForm
                              initial={r}
                              onCancel={() => setEditing(null)}
                              onSubmit={(input) => handleEdit(r.id, input)}
                            />
                          </li>
                        ) : (
                          <ReminderRow
                            key={r.id}
                            reminder={r}
                            msLinked={msLinked}
                            onToggle={() => handleToggle(r)}
                            onEdit={() => setEditing(r.id)}
                            onDelete={() => handleDelete(r.id)}
                          />
                        )
                      )}
                    </ul>
                  </section>
                ))}
              </div>

              {completed.length > 0 && (
                <section className="mt-14">
                  <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-[var(--line)] pb-2">
                    <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-3)]">
                      Terminés
                    </h2>
                    <span className="ui-mono text-[var(--text-3)]">{completed.length}</span>
                  </div>
                  <ul className="divide-y divide-[var(--line)] opacity-60">
                    {completed.map((r) => (
                      <ReminderRow
                        key={r.id}
                        reminder={r}
                        msLinked={msLinked}
                        onToggle={() => handleToggle(r)}
                        onEdit={() => setEditing(r.id)}
                        onDelete={() => handleDelete(r.id)}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          <MicrosoftTodoPanel />
        </div>
      </div>
    </AppShell>
  );
}

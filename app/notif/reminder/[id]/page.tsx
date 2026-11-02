import { notFound } from "next/navigation";
import Link from "next/link";
import { getReminders } from "@/lib/storage";
import { formatRelative, isOverdue } from "@/lib/date";
import { ArrowLeft, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Rappel — BACKSTAGE",
  robots: { index: false, follow: false },
};

export default async function ReminderNotifPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getReminders();
  const reminder = data.reminders.find((r) => r.id === id);

  if (!reminder) notFound();

  const overdue = isOverdue(reminder.dueAt);
  const isDone = reminder.status === "done";

  return (
    <>
      <Link
        href="/reminders"
        className="ui-btn ui-btn--text mb-10 text-[var(--t-small)]"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.6} aria-hidden />
        Rappels
      </Link>

      <div className={cn("ui-card p-6", !isDone && overdue && "border-[var(--danger)]")}>
        <h1
          className={cn(
            "font-display text-[28px] font-semibold leading-[1.08] tracking-[-0.03em]",
            isDone ? "text-[var(--text-3)] line-through" : "text-[var(--text-1)]"
          )}
        >
          {reminder.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="ui-mono inline-flex items-center gap-2 text-[var(--text-3)]">
            <Clock className="w-3.5 h-3.5" strokeWidth={1.6} aria-hidden />
            {formatRelative(reminder.dueAt)}
          </span>
          <span
            className="ui-mono"
            style={{
              color: isDone
                ? "var(--text-3)"
                : overdue
                  ? "var(--danger)"
                  : "var(--text-2)",
            }}
          >
            {isDone ? "Terminé" : overdue ? "En retard" : reminder.status === "snoozed" ? "Repoussé" : "À venir"}
          </span>
        </div>

        {reminder.notes && (
          <div className="mt-6 border-t border-[var(--line)] pt-5">
            <p className="text-[var(--t-body)] leading-relaxed text-[var(--text-2)]">{reminder.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}

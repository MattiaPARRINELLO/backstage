"use client";

// ============================================================
// Grille mensuelle : en-tete du mois, jours et evenements.
// Aucun etat : le parent porte le mois et les evenements charges.
// ============================================================

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/date";
import type { CalendarEvent } from "@/lib/api-client";
import {
  DAYS,
  MONTHS,
  isSpanningOrAllDay,
  visibleSpan,
  layoutMultiDayLanes,
} from "./calendar-utils";

type Week = { days: (number | null)[]; start: Date };

type Props = {
  year: number;
  month: number;
  weeks: Week[];
  events: CalendarEvent[] | undefined;
  loading: boolean;
  todayStr: string;
  onPrev: () => void;
  onNext: () => void;
  onOpenEdit: (evt: CalendarEvent) => void;
  onCreateOnDay: (day: number) => void;
};

export function MonthGrid({
  year,
  month,
  weeks,
  events,
  loading,
  todayStr,
  onPrev,
  onNext,
  onOpenEdit,
  onCreateOnDay,
}: Props) {
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

  return (
    <div className="ui-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
        <button
          onClick={onPrev}
          aria-label="Mois précédent"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <h2 className="font-display text-[length:var(--t-lead)] font-semibold tracking-[-0.03em] text-[var(--text-1)]">
          {MONTHS[month]} {year}
        </h2>
        <button
          onClick={onNext}
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
                              onClick={() => onOpenEdit(evt)}
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
                          onDoubleClick={() => day !== null && onCreateOnDay(day)}
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
                                    onClick={() => onOpenEdit(evt)}
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
  );
}

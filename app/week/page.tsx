import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";
import { getConcerts, getReminders, getIntentions } from "@/lib/storage";
import { fetchGoogleCalendarEvents } from "@/lib/google-actions";
import { CancelIntentionButton } from "./CancelIntention";

type WeekItem = {
  kind: "evenement" | "concert" | "rappel" | "relance";
  label: string;
  detail?: string;
  dueAt: string;
  intentionId?: string;
};

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// Normalise un timestamp (ISO ou date seule) en clé "YYYY-MM-DD", sinon null.
function toDayKey(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Nature de l'entrée : etiquette de donnee, pas de pastille ni de couleur. */
function kindLabel(kind: WeekItem["kind"]): string {
  switch (kind) {
    case "evenement":
      return "événement";
    case "concert":
      return "concert";
    case "rappel":
      return "rappel";
    case "relance":
      return "relance";
  }
}

function chargeLabel(count: number): string {
  if (count === 0) return "libre";
  if (count <= 2) return "léger";
  if (count <= 4) return "moyen";
  return "chargé";
}

export default async function WeekPage() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const days: { key: string; date: Date }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    days.push({ key: toDayKey(d.toISOString())!, date: d });
  }

  const itemsByDay = new Map<string, WeekItem[]>();
  for (const d of days) itemsByDay.set(d.key, []);

  // Événements Google Calendar (compte optionnellement lié)
  try {
    const events = await fetchGoogleCalendarEvents(
      days[0].date.toISOString(),
      new Date(days[6].date.getTime() + 86400000).toISOString()
    );
    for (const e of events) {
      const key = toDayKey(e.start);
      const list = key ? itemsByDay.get(key) : undefined;
      if (list) {
        list.push({
          kind: "evenement",
          label: e.summary,
          detail: e.location ? `@ ${e.location}` : undefined,
          dueAt: e.start,
        });
      }
    }
  } catch {
    // Compte Google non lié ou erreur : on affiche le reste sans événements.
  }

  // Concerts (calendrier local)
  try {
    const concerts = await getConcerts();
    for (const c of concerts.events) {
      const key = toDayKey(c.date);
      const list = key ? itemsByDay.get(key) : undefined;
      if (list) {
        list.push({ kind: "concert", label: c.artist, detail: c.venue, dueAt: c.date });
      }
    }
  } catch {
    // Ignoré : données locales absentes.
  }

  // Rappels
  try {
    const reminders = await getReminders();
    for (const r of reminders.reminders) {
      if (r.status !== "pending") continue;
      const key = toDayKey(r.dueAt);
      const list = key ? itemsByDay.get(key) : undefined;
      if (list) {
        list.push({ kind: "rappel", label: r.title, detail: r.notes, dueAt: r.dueAt });
      }
    }
  } catch {
    // Ignoré.
  }

  // Relances IA programmées (en attente)
  try {
    const { intentions } = await getIntentions();
    for (const it of intentions) {
      if (it.status !== "pending") continue;
      const key = toDayKey(it.dueAt);
      const list = key ? itemsByDay.get(key) : undefined;
      if (list) {
        list.push({
          kind: "relance",
          label: it.subject,
          detail: it.message,
          dueAt: it.dueAt,
          intentionId: it.id,
        });
      }
    }
  } catch {
    // Ignoré.
  }

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-5 pb-[88px] pt-12 sm:px-6 sm:pt-[104px]">
          <PageHeader
            title="Semaine"
            description="Ta charge, d'un coup d'œil : événements, concerts, rappels et relances."
          />

          {/* Grille de semaine : sept colonnes, un seul filet en haut de chaque
              jour, l'aujourd'hui porte un aplat d'accent. */}
          <div className="grid grid-cols-1 sm:grid-cols-7">
            {days.map(({ key, date }, idx) => {
              const items = (itemsByDay.get(key) ?? []).sort((a, b) =>
                a.dueAt.localeCompare(b.dueAt)
              );
              const isToday = idx === 0;
              return (
                <section
                  key={key}
                  aria-current={isToday ? "date" : undefined}
                  className={`border-t border-[var(--line)] px-0 py-6 sm:px-4 ${
                    isToday ? "bg-[var(--accent-soft)]/10" : ""
                  }`}
                >
                  <header>
                    <h2 className="font-display text-[0.9375rem] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
                      {isToday ? "Aujourd'hui" : DAY_NAMES[date.getDay()]}
                    </h2>
                    <p className="ui-mono text-[var(--text-3)]">
                      {date.getDate()} {MONTH_NAMES[date.getMonth()]}
                    </p>
                    <p className="ui-mono mt-1 text-[var(--text-2)]">
                      {chargeLabel(items.length)} · {items.length}
                    </p>
                  </header>

                  {items.length === 0 ? (
                    <p className="mt-3 text-[length:var(--t-small)] text-[var(--text-3)]">
                      Rien de prévu
                    </p>
                  ) : (
                    <ul className="mt-3">
                      {items.map((item, i) => {
                        const time = toDayKey(item.dueAt) === key ? new Date(item.dueAt) : null;
                        return (
                          <li
                            key={`${item.kind}-${i}`}
                            className="flex flex-col gap-1 border-t border-[var(--line)] py-3 first:border-t-0 first:pt-0"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="ui-mono text-[var(--text-3)]">
                                {kindLabel(item.kind)}
                              </span>
                              {time && !Number.isNaN(time.getTime()) && (
                                <span className="ui-mono shrink-0 text-[var(--text-2)]">
                                  {time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                            <p className="text-[0.9375rem] leading-snug text-[var(--text-1)]">
                              {item.label}
                            </p>
                            {item.detail && (
                              <p className="text-[length:var(--t-small)] leading-snug text-[var(--text-2)]">
                                {item.detail}
                              </p>
                            )}
                            {item.kind === "relance" && item.intentionId && (
                              <CancelIntentionButton id={item.intentionId} />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

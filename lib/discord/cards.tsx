/* eslint-disable @next/next/no-img-element -- rendu satori (next/og), pas de DOM navigateur : <img> est la seule balise supportee */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { toHHMM } from "@/lib/utils";
import { CARD_PADDING, CARD_WIDTH, clampText, lineCount } from "./text";
import type { BriefDigest, DiscordEvent, DiscordEventKind } from "./types";

const WIDTH = CARD_WIDTH;
const PADDING = CARD_PADDING;

const BG = "#0e0e12";
const SURFACE = "#141414";
const BORDER = "#262626";
const TEXT = "#e5e5e5";
const TEXT_DIM = "#8a8a8a";
const TEXT_FAINT = "#525252";

const ACCENT: Record<DiscordEventKind, string> = {
  "daily-brief": "#d4a373",
  course: "#7aa2f7",
  reminder: "#d4a373",
  intention: "#cba6f7",
  alert: "#f38ba8",
  test: "#a6e3a1",
};

/* ------------------------------------------------------------------ */
/* Ressources (polices + logo) — lues une fois par process              */
/* ------------------------------------------------------------------ */

const assetCache = new Map<string, Buffer>();

async function loadBytes(relativePath: string): Promise<Buffer> {
  const cached = assetCache.get(relativePath);
  if (cached) return cached;
  const bytes = await readFile(path.join(process.cwd(), relativePath));
  assetCache.set(relativePath, bytes);
  return bytes;
}

async function loadFonts() {
  const [regular, semibold, mono, monoBold] = await Promise.all([
    loadBytes("assets/fonts/inter-regular.ttf"),
    loadBytes("assets/fonts/inter-semibold.ttf"),
    loadBytes("assets/fonts/jetbrains-mono-regular.ttf"),
    loadBytes("assets/fonts/jetbrains-mono-bold.ttf"),
  ]);
  return [
    { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "JetBrains Mono", data: mono, weight: 400 as const, style: "normal" as const },
    { name: "JetBrains Mono", data: monoBold, weight: 700 as const, style: "normal" as const },
  ];
}

async function logoDataUri(): Promise<string> {
  // Icône déjà publique (servie par la PWA) : présente dans le build standalone.
  const png = await loadBytes("public/icons/icon-192.png");
  return `data:image/png;base64,${png.toString("base64")}`;
}

/* ------------------------------------------------------------------ */
/* Mesure : satori ne renvoie pas la hauteur du contenu, on l'estime    */
/* pour dimensionner l'image (sinon le bas est coupé net).              */
/* ------------------------------------------------------------------ */

const LINE_GAP = 32;

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

function Label({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: "JetBrains Mono",
        fontSize: 17,
        letterSpacing: 3,
        textTransform: "uppercase",
        color: TEXT_FAINT,
      }}
    >
      {children}
    </div>
  );
}

const HEADER_HEIGHT = 74;

function Header({ kind, right, logo }: { kind: DiscordEventKind; right: string; logo: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: HEADER_HEIGHT,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <img src={logo} alt="" width={44} height={44} style={{ borderRadius: 10 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label>backstage</Label>
          <div style={{ display: "flex", fontFamily: "Inter", fontSize: 22, color: TEXT_DIM }}>
            {kindLabel(kind)}
          </div>
        </div>
      </div>
      <Label>{right}</Label>
    </div>
  );
}

function kindLabel(kind: DiscordEventKind): string {
  const labels: Record<DiscordEventKind, string> = {
    "daily-brief": "Brief du jour",
    course: "Emploi du temps",
    reminder: "Rappel",
    intention: "Relance",
    alert: "Supervision",
    test: "Connexion",
  };
  return labels[kind];
}

const TITLE_SIZE_LONG = 50;
const TITLE_SIZE_SHORT = 58;

function titleSize(text: string): number {
  return text.length <= 26 ? TITLE_SIZE_SHORT : TITLE_SIZE_LONG;
}

function titleHeight(text: string): number {
  const size = titleSize(text);
  return Math.round(lineCount(text, size) * size * 1.14);
}

function Title({ children, color }: { children: string; color: string }) {
  const size = titleSize(children);
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 24, minHeight: titleHeight(children) }}>
      <div style={{ display: "flex", width: 6, background: color, borderRadius: 3 }} />
      <div
        style={{
          display: "flex",
          fontFamily: "Inter",
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1.14,
          color: TEXT,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const BODY_SIZE = 25;
const BODY_LINE = 40;
const WEATHER_GAP = 12;

function bodyHeight(text: string): number {
  return lineCount(text, BODY_SIZE) * BODY_LINE;
}

function Body({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: "Inter",
        fontSize: BODY_SIZE,
        lineHeight: 1.5,
        color: TEXT_DIM,
      }}
    >
      {children}
    </div>
  );
}

const SECTION_LINE = 34;

function sectionLines(lines: string[]): number {
  return lines.reduce((total, line) => total + lineCount(line, 24), 0);
}

function Section({ title, lines }: { title: string; lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
      <Label>{title}</Label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              fontFamily: "Inter",
              fontSize: 24,
              color: TEXT,
              lineHeight: 1.3,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

const STAT_HEIGHT = 120;
const STAT_VALUE_MAX = 22;

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: "16px 20px",
        flex: 1,
        height: STAT_HEIGHT,
      }}
    >
      <Label>{label}</Label>
      <div
        style={{
          display: "flex",
          fontFamily: "Inter",
          fontSize: 26,
          lineHeight: 1.25,
          color: color ?? TEXT,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const FOOTER_HEIGHT = 44;

function Footer({ children }: { children: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, height: FOOTER_HEIGHT }}>
      <div style={{ display: "flex", height: 1, background: BORDER }} />
      <Label>{children}</Label>
    </div>
  );
}

function Spacer() {
  return <div style={{ display: "flex", flexGrow: 1 }} />;
}

function Shell({
  accent,
  children,
}: {
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: BG,
        borderTop: `6px solid ${accent}`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: LINE_GAP,
          padding: PADDING,
          width: "100%",
          height: "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Hauteur = padding + blocs mesurés + gouttières. */
function cardHeight(blocks: number[]): number {
  const content = blocks.reduce((a, b) => a + b, 0);
  const gaps = LINE_GAP * Math.max(0, blocks.length - 1);
  return PADDING * 2 + content + gaps;
}

/* ------------------------------------------------------------------ */
/* Contenu par type : préparation + rendu                               */
/* ------------------------------------------------------------------ */

interface Prepared {
  height: number;
  render: (logo: string) => React.ReactElement;
}

function prepareBrief(event: Extract<DiscordEvent, { kind: "daily-brief" }>): Prepared {
  const d: BriefDigest = event.digest;
  const date = new Date(`${d.date}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const headline = clampText(d.focus || d.weather || "Brief du jour", 96);
  const courseLines = d.courses
    .slice(0, 4)
    .map((c) => clampText([c.time, c.title].filter(Boolean).join("  "), 42));
  const reminderLines = d.reminders.slice(0, 4).map((r) => clampText(r, 46));
  const agendaLines = d.agenda.slice(0, 4).map((a) => clampText(a, 46));
  const weather = d.weather ? clampText(d.weather, 90) : "";
  const statValues = {
    unread: String(d.unreadCount),
    urgent: String(d.urgentEmails.length),
    leetcode: d.leetcode ? clampText(d.leetcode, STAT_VALUE_MAX) : "—",
  };

  const sections = [
    { title: "Cours", lines: courseLines, count: sectionLines(courseLines) * SECTION_LINE },
    { title: "Rappels", lines: reminderLines, count: sectionLines(reminderLines) * SECTION_LINE },
    { title: "Agenda", lines: agendaLines, count: sectionLines(agendaLines) * SECTION_LINE },
  ].filter((s) => s.lines.length > 0);

  const sectionHeight = Math.max(0, ...sections.map((s) => 17 + 12 + s.count + 12));

  return {
    height: cardHeight([
      HEADER_HEIGHT,
      titleHeight(headline),
      weather ? bodyHeight(weather) + WEATHER_GAP : 0,
      sectionHeight,
      STAT_HEIGHT,
      FOOTER_HEIGHT,
    ]),
    render: (logo) => (
      <Shell accent={ACCENT["daily-brief"]}>
        <Header kind="daily-brief" right={date} logo={logo} />
        <Title color={ACCENT["daily-brief"]}>{headline}</Title>
        {weather ? (
          <div style={{ display: "flex", paddingBottom: WEATHER_GAP }}>
            <Body>{weather}</Body>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 44 }}>
          {sections.map((s) => (
            <Section key={s.title} title={s.title} lines={s.lines} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <Stat label="non lus" value={statValues.unread} />
          <Stat
            label="urgents"
            value={statValues.urgent}
            color={d.urgentEmails.length > 0 ? "#f9e2af" : TEXT}
          />
          <Stat label="leetcode" value={statValues.leetcode} />
        </div>
        <Spacer />
        <Footer>backstage · brief du jour</Footer>
      </Shell>
    ),
  };
}

function prepareCourse(event: Extract<DiscordEvent, { kind: "course" }>): Prepared {
  const { course, leadMin } = event;
  const at = `${toHHMM(new Date(course.start).toISOString())} – ${toHHMM(new Date(course.end).toISOString())}`;
  const title = clampText(course.subject, 90);
  const room = clampText(course.room || (course.remote ? "à distance" : "—"), 30);
  const teacher = clampText(course.teacher || "—", 30);
  const detail = clampText([course.lessonType, course.group].filter(Boolean).join(" · ") || "Séance", 110);

  return {
    height: cardHeight([HEADER_HEIGHT, titleHeight(title), STAT_HEIGHT, bodyHeight(detail), FOOTER_HEIGHT]),
    render: (logo) => (
      <Shell accent={ACCENT.course}>
        <Header kind="course" right={`dans ${leadMin} min`} logo={logo} />
        <Title color={ACCENT.course}>{title}</Title>
        <div style={{ display: "flex", gap: 16 }}>
          <Stat label="horaire" value={at} />
          <Stat label="salle" value={clampText(room, STAT_VALUE_MAX)} />
          <Stat label="enseignant" value={clampText(teacher, STAT_VALUE_MAX)} />
        </div>
        <Body>{detail}</Body>
        <Spacer />
        <Footer>backstage · emploi du temps CESAR</Footer>
      </Shell>
    ),
  };
}

function prepareReminder(event: Extract<DiscordEvent, { kind: "reminder" }>): Prepared {
  const r = event.reminder;
  const due = new Date(r.dueAt);
  const dayLabel = due.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeLabel = due.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const title = clampText(r.title, 90);
  const notes = clampText(r.notes || "Échéance atteinte — à traiter maintenant.", 220);

  return {
    height: cardHeight([HEADER_HEIGHT, titleHeight(title), bodyHeight(notes), STAT_HEIGHT, FOOTER_HEIGHT]),
    render: (logo) => (
      <Shell accent={ACCENT.reminder}>
        <Header kind="reminder" right={r.recurrence ? `récurrent · ${r.recurrence}` : "ponctuel"} logo={logo} />
        <Title color={ACCENT.reminder}>{title}</Title>
        <Body>{notes}</Body>
        <div style={{ display: "flex", gap: 16 }}>
          <Stat label="échéance" value={clampText(dayLabel, STAT_VALUE_MAX)} />
          <Stat label="heure" value={timeLabel} />
        </div>
        <Spacer />
        <Footer>backstage · ouvre l'app pour marquer comme fait</Footer>
      </Shell>
    ),
  };
}

function prepareIntention(event: Extract<DiscordEvent, { kind: "intention" }>): Prepared {
  const it = event.intention;
  const title = clampText(it.subject, 90);
  const body = clampText(it.message || `Tu voulais relancer sur « ${it.subject} ».`, 220);
  const dateLabel = new Date(it.dueAt).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return {
    height: cardHeight([HEADER_HEIGHT, titleHeight(title), bodyHeight(body), FOOTER_HEIGHT]),
    render: (logo) => (
      <Shell accent={ACCENT.intention}>
        <Header kind="intention" right={dateLabel} logo={logo} />
        <Title color={ACCENT.intention}>{title}</Title>
        <Body>{body}</Body>
        <Spacer />
        <Footer>backstage · relance programmée</Footer>
      </Shell>
    ),
  };
}

function prepareAlert(event: Extract<DiscordEvent, { kind: "alert" }>): Prepared {
  const color = event.level === "warn" ? "#f9e2af" : ACCENT.alert;
  const title = clampText(event.message, 96);
  const moduleName = clampText(event.module, 60);
  const detail = event.detail ? clampText(event.detail, 260) : "";
  const right = `${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · ${
    event.level === "warn" ? "warn" : "error"
  }`;

  return {
    height: cardHeight([HEADER_HEIGHT, titleHeight(title), 62, detail ? bodyHeight(detail) : 0, FOOTER_HEIGHT]),
    render: (logo) => (
      <Shell accent={color}>
        <Header kind="alert" right={right} logo={logo} />
        <Title color={color}>{title}</Title>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, height: 62 }}>
          <Label>module</Label>
          <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 24, color: TEXT }}>
            {moduleName}
          </div>
        </div>
        {detail ? <Body>{detail}</Body> : null}
        <Spacer />
        <Footer>{event.level === "warn" ? "backstage · avertissement" : "backstage · erreur"}</Footer>
      </Shell>
    ),
  };
}

function prepareTest(): Prepared {
  const title = "Canal Discord opérationnel";
  const body = clampText(
    "Les notifications BACKSTAGE arriveront ici : brief du jour, cours 30 min avant, rappels, relances et alertes techniques.",
    220
  );
  return {
    height: cardHeight([HEADER_HEIGHT, titleHeight(title), bodyHeight(body), FOOTER_HEIGHT]),
    render: (logo) => (
      <Shell accent={ACCENT.test}>
        <Header
          kind="test"
          right={new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          logo={logo}
        />
        <Title color={ACCENT.test}>{title}</Title>
        <Body>{body}</Body>
        <Spacer />
        <Footer>backstage · test depuis les réglages</Footer>
      </Shell>
    ),
  };
}

function prepare(event: DiscordEvent): Prepared {
  switch (event.kind) {
    case "daily-brief":
      return prepareBrief(event);
    case "course":
      return prepareCourse(event);
    case "reminder":
      return prepareReminder(event);
    case "intention":
      return prepareIntention(event);
    case "alert":
      return prepareAlert(event);
    case "test":
      return prepareTest();
  }
}

/** Rendu PNG (1100 × hauteur adaptée au contenu). */
export async function renderEventCard(event: DiscordEvent): Promise<Uint8Array> {
  const [fonts, logo] = await Promise.all([loadFonts(), logoDataUri()]);
  const card = prepare(event);
  const image = new ImageResponse(card.render(logo), {
    width: WIDTH,
    height: card.height,
    fonts,
  });
  return new Uint8Array(await image.arrayBuffer());
}

/** Hauteur d'image calculée (exportée pour les tests de mise en page). */
export function cardHeightFor(event: DiscordEvent): number {
  return prepare(event).height;
}

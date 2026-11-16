/**
 * Client CESAR 100% HTTP (aucun navigateur) — fonctionne en prod standalone.
 *
 * Pipeline : GET /connexion (CSRF) → POST login → skip écran CVEC →
 * POST /session/update (année académique courante) → GET /schedule → extraction
 * de l'attribut data-tui-calendar-event-lesson-schedules-value
 * (JSON complet de toutes les séances) → normalisation.
 *
 * Identifiants : CESAR_USERNAME / CESAR_PASSWORD (env), base optionnelle CESAR_BASE.
 */
import type { ScheduleCourse } from "@/lib/types/schedule";
import { serverLog } from "./logger";
import { getConfig } from "@/lib/config";

const TIMEOUT_MS = 45_000;

function cesarBase(): string {
  return getConfig().CESAR_BASE.replace(/\/$/, "");
}

/** Normalise une séance brute CESAR (payload data-tui-calendar-event-lesson-schedules-value). */
export function normalizeLesson(item: Record<string, unknown>): ScheduleCourse | null {
  const schoolSubject = item.schoolSubject as { name?: string; label?: string } | undefined;
  const subject = String(schoolSubject?.name || schoolSubject?.label || "Cours").trim();
  const teachers = Array.isArray(item.teachers) ? item.teachers : [];
  const teacher = teachers
    .map((t: { firstName?: string; lastName?: string; fullName?: string; name?: string }) =>
      t?.fullName || t?.name || [t?.firstName, t?.lastName].filter(Boolean).join(" ")
    )
    .filter(Boolean)
    .join(", ");
  const rooms = Array.isArray(item.rooms) ? item.rooms : [];
  const roomList = rooms.map((r) => (typeof r === "string" ? r : r?.name || "")).filter(Boolean);
  const building = !(rooms[0] instanceof Object) || typeof rooms[0] !== "object" ? "" : rooms[0]?.building?.name || "";
  const room = building ? `${roomList.join(" / ")}${roomList.length ? ", " : ""}${building}` : roomList.join(" / ");
  const start = Number(item.startDate ?? item.start ?? item.startsAt ?? 0);
  const end = Number(item.endDate ?? item.end ?? item.endsAt ?? 0);
  if (!start || !end || !(end > start)) return null;

  return {
    uuid: String(item.uuid) || "",
    subject,
    teacher,
    room,
    start,
    end,
    lessonType: String(item.lessonType || ""),
    cancelled: item.cancelDesc != null || (item.lessonStatus ? item.lessonStatus !== "Actif" : false),
    remote: item.remote === true,
    description: String(item.description || ""),
    group: String((item.group as { name?: string } | undefined)?.name || ""),
  };
}

/** Extrait l'attribut lesson-schedules de la page (avec index de premier match — pas de regex backtracking sur 6 Mo). */
export function _extractLessonsJson(html: string): string {
  const key = "data-tui-calendar-event-lesson-schedules-value=\"";
  const i = html.indexOf(key);
  if (i === -1) throw new Error("attribut lesson-schedules absent du HTML");
  const start = i + key.length;
  // les guillemets internes sont echappes en &quot; : le prochain " brut termine l'attribut
  const end = html.indexOf('"', start);
  if (end === -1) throw new Error("attribut lesson-schedules non termine");
  return html
    .slice(start, end)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Année académique courante au format CESAR ("2026-2027" à partir de septembre). */
export function currentAcademicYear(now = new Date()): string {
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

/** Session a utiliser : l'annee courante si proposee, sinon la plus recente de la liste. */
export function pickSession(options: string[], now = new Date()): string | null {
  if (!options.length) return null;
  const target = currentAcademicYear(now);
  return options.includes(target) ? target : options[0];
}

export type SessionSelect = { selected: string; options: string[]; token: string };

/** Extrait le select `training_session_select[sessions]` (annee scolaire active dans CESAR). */
export function _extractSessionSelect(html: string): SessionSelect | null {
  const nameAt = html.indexOf('name="training_session_select[sessions]"');
  if (nameAt === -1) return null;
  const open = html.lastIndexOf("<select", nameAt);
  const close = html.indexOf("</select>", nameAt);
  if (open === -1 || close === -1) return null;
  const block = html.slice(open, close);
  const options = [...block.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
  const selected = /<option value="([^"]*)"[^>]*selected="selected"/.exec(block)?.[1] ?? "";
  const formOpen = html.lastIndexOf("<form", nameAt);
  const formClose = html.indexOf("</form>", nameAt);
  const form = formOpen !== -1 && formClose !== -1 ? html.slice(formOpen, formClose) : html;
  const token = /name="training_session_select\[_token\]"[^>]*value="([^"]*)"/.exec(form)?.[1] ?? "";
  return { selected, options, token };
}

/** Récupère l'input hidden CSRF d'un formulaire. */
function extractCsrf(html: string, formNameRe: RegExp): string {
  const inputs = html.match(/<input[^>]*>/g) || [];
  for (const input of inputs) {
    const name = /name="([^"]*)"/.exec(input)?.[1];
    if (name && formNameRe.test(name)) return /value="([^"]*)"/.exec(input)?.[1] || "";
  }
  return "";
}

export async function fetchCesarSchedule(): Promise<ScheduleCourse[]> {
  const { CESAR_USERNAME: user, CESAR_PASSWORD: pass } = getConfig();
  if (!user || !pass) throw new Error("CESAR_USERNAME / CESAR_PASSWORD manquants");

  const cookies = new Map<string, string>();
  const track = (res: Response) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      if (i > 0) cookies.set(kv.slice(0, i), kv.slice(i + 1));
    }
  };
  const cookieHeader = () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  const postForm = (path: string, body: URLSearchParams, referer?: string) =>
    fetch(cesarBase() + path, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader(), ...(referer ? { Referer: cesarBase() + referer } : {}) },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  const get = (path: string) =>
    fetch(cesarBase() + path, { headers: { Cookie: cookieHeader() }, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });

  // 1) page de login → token CSRF
  const r1 = await get("/connexion");
  track(r1);
  const loginHtml = await r1.text();
  const csrf = extractCsrf(loginHtml, /^(?:_?csrf_token)$/);
  if (!csrf) throw new Error("CSRF introuvable sur /connexion");

  // 2) POST login
  const r2 = await postForm("/connexion", new URLSearchParams({
    _username: user.trim(),
    _password: pass.trim(),
    _csrf_token: csrf,
    _referer: "",
  }), "/connexion");
  track(r2);
  if (r2.status !== 302 || r2.headers.get("location") === "/connexion") {
    throw new Error("login CESAR refuse");
  }

  // 3) écran CVEC éventuel → bouton "Rappeler plus tard"
  const home = await fetch(cesarBase() + "/", { headers: { Cookie: cookieHeader() }, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
  track(home);
  const homePath = home.status === 302 ? home.headers.get("location") || "/" : "/";
  let homeHtml = home.status === 302 ? "" : await home.text();
  if (homePath.includes("/televersement/cvec")) {
    const rc = await fetch(cesarBase() + homePath, { headers: { Cookie: cookieHeader() }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    track(rc);
    const hc = await rc.text();
    const skipName = /<button[^>]*name="(cvec_file\[[^\]]*\]|[^"]*skip[^"]*)"/.exec(hc)?.[1];
    const csrfKey = /<input[^>]*name="([^"]*token[^"]*)"/.exec(hc)?.[1];
    if (skipName) {
      const body = new URLSearchParams();
      if (csrfKey) body.set(csrfKey, extractCsrf(hc, new RegExp(`^${csrfKey!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`)));
      body.set(skipName, "");
      const rs = await postForm(homePath, body, homePath);
      track(rs);
      console.log(`[cesar] ecran CVEC ignore (${rs.status})`);
    }
  }

  // 3bis) CESAR ouvre sur l'annee precedente : basculer sur la session courante.
  // Sans cela, on scrape l'EDT de l'an dernier (aucune seance a venir).
  if (!homeHtml) {
    const rh = await get(homePath);
    track(rh);
    homeHtml = await rh.text();
  }
  const session = _extractSessionSelect(homeHtml);
  const wanted = session ? pickSession(session.options) : null;
  if (session && wanted && session.token && wanted !== session.selected) {
    const ru = await postForm(
      "/session/update",
      new URLSearchParams({
        "training_session_select[sessions]": wanted,
        "training_session_select[_token]": session.token,
      }),
      "/"
    );
    track(ru);
    console.log(`[cesar] session ${session.selected} -> ${wanted} (${ru.status})`);
  }


  // 4) page EDT — chemins connus
  const candidatePaths = ["/schedule", "/emploi-du-temps"];
  let lastStatus = 0;
  for (const p of candidatePaths) {
    const r = await get(p);
    track(r);
    const html = await r.text();
    if (/\/(connexion|login)/.test(r.headers.get("location") || r.url)) continue;
    try {
      const lessons = _extractLessonsJson(html);
      const data = JSON.parse(lessons) as Record<string, unknown>[];
      const courses = data.map(normalizeLesson).filter((c): c is ScheduleCourse => !!c && !c.cancelled);
      courses.sort((a, b) => a.start - b.start);
      console.log(`[cesar] EDT recupere : ${courses.length} seances via ${p}`);
      return courses;
    } catch (err) {
      lastStatus = r.status;
      void serverLog("cesar", "warn", `Pas de lessons sur ${p} (${r.status})`, err);
    }
  }
  throw new Error(`emploi du temps introuvable sur ${candidatePaths.join(", ")} (dernier status ${lastStatus})`);
}

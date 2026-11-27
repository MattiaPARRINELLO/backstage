import { getGmailClient, getCalendarClient } from "./google-client";
import type {
  GmailMessage,
  GmailThread,
  GoogleCalendarEvent as CalendarEventItem,
} from "@/lib/types";
import { googleFetch } from "./google-fetch";

type GmailHeader = { name?: string; value?: string };
type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessageRaw = {
  id: string;
  threadId: string;
  payload?: {
    headers?: GmailHeader[];
    parts?: GmailPart[];
    body?: { data?: string };
    mimeType?: string;
  };
  labelIds?: string[];
};

type GmailThreadRaw = {
  id: string;
  messages?: GmailMessageRaw[];
};

type GmailListResponse = {
  messages?: { id: string; threadId: string }[];
  threads?: { id: string }[];
  resultSizeEstimate?: number;
  nextPageToken?: string;
};

type CalendarEventRaw = {
  id?: string;
  summary?: string | null;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
  colorId?: string;
};

type CalendarEventsResponse = {
  items?: CalendarEventRaw[];
};

// Gmail compte 10 unites de quota par fil complet. Envoyer 200 requetes d'un
// coup depassait le quota par utilisateur et faisait echouer le scan ; quatre
// requetes a la fois restent sous le plafond et laissent le retry 429 agir.
const GMAIL_FETCH_CONCURRENCY = 4;

async function settleWithConcurrency<T, R>(
  items: readonly T[],
  worker: (item: T) => Promise<R>,
  limit = GMAIL_FETCH_CONCURRENCY
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) continue;
      try {
        results[index] = { status: "fulfilled", value: await worker(item) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run())
  );
  return results;
}

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}

function encodeEmail(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function extractHeader(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// Encodage RFC 2047 pour les headers contenant des caractères non-ASCII.
// Ex: "Validation photos Dina – Pagaille" → "=?UTF-8?B?VmFsaWRhdGlv...?="
function encodeRfc2047(value: string): string {
  if (!/[^\x00-\x7F]/.test(value)) return value;
  const encoded = Buffer.from(value, "utf-8").toString("base64");
  return `=?UTF-8?B?${encoded}?=`;
}

// Les emails HTML-only n'ont pas de version texte : on extrait le texte du HTML
// plutôt que de renvoyer un contenu vide ou du HTML brut illisible.
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findBodyPart(
  parts: GmailPart[] | undefined,
  mimeType: string | undefined,
  body: { data?: string } | undefined,
  target: "text/plain" | "text/html"
): string {
  if (mimeType === target && body?.data) return decodeBase64Url(body.data);
  if (!parts) return "";
  for (const part of parts) {
    const found = findBodyPart(part.parts, part.mimeType, part.body, target);
    if (found) return found;
  }
  return "";
}

export function extractBody(parts: GmailPart[] | undefined, mimeType: string | undefined, body: { data?: string } | undefined): string {
  const plain = findBodyPart(parts, mimeType, body, "text/plain");
  if (plain) return plain;
  const html = findBodyPart(parts, mimeType, body, "text/html");
  return html ? extractTextFromHtml(html) : "";
}

/** Traduit un message Gmail brut en message exploitable (headers + corps). */
function toGmailMessage(msg: GmailMessageRaw): GmailMessage {
  const headers = msg.payload?.headers ?? [];
  const body = msg.payload
    ? extractBody(msg.payload.parts, msg.payload.mimeType, msg.payload.body)
    : "";
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: extractHeader(headers, "From"),
    to: extractHeader(headers, "To") || undefined,
    subject: extractHeader(headers, "Subject"),
    date: extractHeader(headers, "Date"),
    snippet: body,
    body,
    unread: msg.labelIds?.includes("UNREAD") ?? true,
    messageId: extractHeader(headers, "Message-ID"),
    fromMe: msg.labelIds?.includes("SENT") ?? false,
  };
}

export async function fetchGmailMessages(query?: string, maxResults = 10): Promise<GmailMessage[]> {
  const auth = await getGmailClient();

  // Pagination : l'API Gmail trie les resultats par pertinence quand une query
  // est fournie, donc on pagine pour recuperer jusqu'a `maxResults` messages
  // puis on trie par date cote client. Cela evite de rater les mails recents
  // noyes par des messages plus "pertinents" mais plus anciens.
  const collected: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;
  const pageSize = Math.min(Math.max(maxResults, 1), 100);
  while (collected.length < maxResults) {
    const params = new URLSearchParams({
      userId: "me",
      maxResults: String(Math.min(pageSize, maxResults - collected.length)),
    });
    if (query) params.set("q", query);
    if (pageToken) params.set("pageToken", pageToken);

    const list = await googleFetch<GmailListResponse>(
      auth,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`
    );
    const page = list.messages ?? [];
    collected.push(...page);
    pageToken = list.nextPageToken;
    if (!pageToken || page.length === 0) break;
  }

  const messages = collected.slice(0, maxResults);

  const results = await settleWithConcurrency(
    messages,
    async ({ id }) => {
      const msg = await googleFetch<GmailMessageRaw>(
        auth,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`
      );
      return toGmailMessage(msg);
    }
  );

  const fulfilled = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as { status: "fulfilled"; value: GmailMessage }).value);

  // Un message dont le MIME ne se decode pas est ignore seul : les autres
  // restent exploitables. On le signale sans exposer son contenu.
  const rejected = results.length - fulfilled.length;
  if (rejected > 0) {
    console.warn(`[gmail] ${rejected} message(s) illisible(s) ignore(s)`);
  }

  // Tri deterministe : Gmail ne garantit pas l'ordre de /messages. Deux appels
  // identiques doivent selectionner le meme lot.
  return fulfilled.sort(compareGmailMessages);
}

function gmailTimestamp(date: string): number {
  const parsed = Date.parse(date);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function compareGmailMessages(a: GmailMessage, b: GmailMessage): number {
  const ta = gmailTimestamp(a.date);
  const tb = gmailTimestamp(b.date);
  if (ta !== tb) return tb - ta;
  // Dates identiques ou illisibles : l'ID departage.
  return a.id.localeCompare(b.id);
}

/**
 * Fils complets correspondant a une recherche Gmail.
 *
 * Gmail cherche dans un fil : une reponse sans mot-cle (« c'est ok pour
 * vendredi ») est donc ramenee avec la demande qui l'a declenchee. Chaque fil
 * arrive avec tous ses messages, du plus recent au plus ancien.
 */
export async function fetchGmailThreads(
  query?: string,
  maxThreads = 100
): Promise<GmailThread[]> {
  const auth = await getGmailClient();

  const collected: { id: string }[] = [];
  let pageToken: string | undefined;
  const pageSize = Math.min(Math.max(maxThreads, 1), 100);
  while (collected.length < maxThreads) {
    const params = new URLSearchParams({
      userId: "me",
      maxResults: String(Math.min(pageSize, maxThreads - collected.length)),
    });
    if (query) params.set("q", query);
    if (pageToken) params.set("pageToken", pageToken);

    const list = await googleFetch<GmailListResponse>(
      auth,
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?${params.toString()}`
    );
    const page = list.threads ?? [];
    collected.push(...page);
    pageToken = list.nextPageToken;
    if (!pageToken || page.length === 0) break;
  }

  const results = await settleWithConcurrency(
    collected.slice(0, maxThreads),
    async ({ id }) => {
      const raw = await googleFetch<GmailThreadRaw>(
        auth,
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=full`
      );
      const messages = (raw.messages ?? []).map(toGmailMessage);
      return {
        id: raw.id || id,
        messages: messages.sort(compareGmailMessages),
      };
    }
  );

  const threads = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as { status: "fulfilled"; value: GmailThread }).value)
    .filter((thread) => thread.messages.length > 0);

  const rejected = results.length - threads.length;
  if (rejected > 0) {
    console.warn(`[gmail] ${rejected} fil(s) illisible(s) ignore(s)`);
  }

  // Aucun fil lisible alors que Gmail a repondu : ne pas renvoyer une liste
  // vide, qui ferait dire au scan « aucun fil trouve » et masquerait un quota
  // ou une panne d'API.
  const failed = results.filter((r) => r.status === "rejected").length;
  if (threads.length === 0 && failed > 0) {
    const first = results.find(
      (r): r is PromiseRejectedResult => r.status === "rejected"
    );
    const reason =
      first?.reason instanceof Error ? first.reason.message : "raison inconnue";
    throw new Error(
      `Aucun fil Gmail lisible (${failed} echec(s) sur ${results.length}) : ${reason}`
    );
  }

  return threads.sort(compareGmailThreads);
}

/**
 * Fil complet par identifiant.
 *
 * Un module ne joint jamais l'API Gmail directement : il demande l'identifiant,
 * le noyau rend un fil deja trie, ou `null` s'il n'existe pas.
 */
export async function fetchGmailThread(
  threadId: string
): Promise<GmailThread | null> {
  const auth = await getGmailClient();
  const raw = await googleFetch<GmailThreadRaw | null>(
    auth,
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`
  );
  const messages = (raw?.messages ?? []).map(toGmailMessage);
  if (!raw || messages.length === 0) return null;
  return { id: raw.id || threadId, messages: messages.sort(compareGmailMessages) };
}

/** Message complet par identifiant, ou `null` s'il n'existe pas. */
export async function fetchGmailMessage(
  messageId: string
): Promise<GmailMessage | null> {
  const auth = await getGmailClient();
  const raw = await googleFetch<GmailMessageRaw | null>(
    auth,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`
  );
  return raw ? toGmailMessage(raw) : null;
}

/** Le fil le plus recent d'abord ; l'ID departage deux dates identiques. */
function compareGmailThreads(a: GmailThread, b: GmailThread): number {
  const first = a.messages[0];
  const second = b.messages[0];
  const ta = first ? gmailTimestamp(first.date) : Number.NEGATIVE_INFINITY;
  const tb = second ? gmailTimestamp(second.date) : Number.NEGATIVE_INFINITY;
  if (ta !== tb) return tb - ta;
  return a.id.localeCompare(b.id);
}

export async function sendGmailReply(emailId: string, responseText: string): Promise<string> {
  const auth = await getGmailClient();

  const original = await googleFetch<GmailMessageRaw>(
    auth,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Reply-To&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References`
  );

  const headers = original.payload?.headers ?? [];
  const from = extractHeader(headers, "From");
  const toHeader = extractHeader(headers, "To");
  const ccHeader = extractHeader(headers, "Cc");
  const replyToHeader = extractHeader(headers, "Reply-To");
  const subject = extractHeader(headers, "Subject");
  const messageId = extractHeader(headers, "Message-ID");
  const references = extractHeader(headers, "References");
  const threadId = original.threadId ?? "";
  const isSent = original.labelIds?.includes("SENT") ?? false;

  // Extraire toutes les adresses email d'une ligne multi-destinataires
  const extractAllEmails = (header: string): string[] => {
    if (!header) return [];
    return [...header.matchAll(/<([^>]+)>/g)].map((m) => m[1]);
  };

  // Déterminer le ou les destinataires de la réponse
  let toRecipients: string[];
  if (isSent && toHeader) {
    // Mail envoyé par l'utilisateur : répondre aux destinataires originaux
    toRecipients = extractAllEmails(toHeader);
  } else if (replyToHeader) {
    // RFC 5322 : Reply-To a priorité
    toRecipients = extractAllEmails(replyToHeader);
  } else {
    // Cas normal : répondre à l'expéditeur
    toRecipients = extractAllEmails(from);
  }

  // Si aucun email extrait (pas de <...> dans le header), utiliser le header brut
  if (toRecipients.length === 0) {
    toRecipients = [isSent && toHeader ? toHeader : from].filter(Boolean);
  }

  const replySubject = subject.match(/^Re:/i) ? subject : `Re: ${subject}`;

  let raw = `To: ${toRecipients.join(", ")}\n`;
  raw += `Subject: ${encodeRfc2047(replySubject)}\n`;
  // Conserver les CC originaux (sauf l'utilisateur lui-même dans un mail envoyé)
  if (ccHeader) {
    raw += `Cc: ${ccHeader}\n`;
  }
  if (messageId) raw += `In-Reply-To: ${messageId}\n`;
  if (messageId || references) raw += `References: ${references ? `${references} ` : ""}${messageId}\n`;
  raw += `Content-Type: text/plain; charset="UTF-8"\n\n`;
  raw += responseText;

  const sent = await googleFetch<{ id?: string }>(
    auth,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      body: JSON.stringify({
        threadId,
        raw: encodeEmail(raw),
      }),
    }
  );

  return sent.id ?? "";
}

export async function sendGmailMessage(
  to: string,
  subject: string,
  body: string
): Promise<string> {
  const auth = await getGmailClient();

  const raw = `To: ${to}\nSubject: ${encodeRfc2047(subject)}\nContent-Type: text/plain; charset="UTF-8"\n\n${body}`;

  const sent = await googleFetch<{ id?: string }>(
    auth,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      body: JSON.stringify({
        raw: encodeEmail(raw),
      }),
    }
  );

  return sent.id ?? "";
}

// Date/heure ISO que Google peut interpréter. Une dateHeure naïve (sans
// décalage ni Z) est rejetée par l'API Calendar (« Missing time zone
// definition ») : on lui attache alors le fuseau local du serveur. Une valeur
// déjà qualifiée (Z, ±hh:mm) ou une date seule (journée entière) est laissée
// intacte.
function calendarDateTime(value: string): { dateTime: string; timeZone?: string } {
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const timeZone = hasOffset ? undefined : localTimezone();
  return { dateTime: value, ...(timeZone ? { timeZone } : {}) };
}

let cachedTimezone: string | undefined;
function localTimezone(): string {
  cachedTimezone ??= Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return cachedTimezone;
}

export async function createGoogleCalendarEvent(
  summary: string,
  start: string,
  end: string,
  location?: string,
  description?: string,
  colorId?: string
): Promise<string> {
  const auth = await getCalendarClient();

  const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end);

  const event = await googleFetch<{ id?: string }>(
    auth,
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      body: JSON.stringify({
        summary,
        start: isAllDay ? { date: start } : calendarDateTime(start),
        end: isAllDay ? { date: end } : calendarDateTime(end),
        location,
        description,
        colorId,
      }),
    }
  );

  return event.id ?? "";
}

export async function updateGoogleCalendarEvent(
  eventId: string,
  updates: {
    summary?: string | undefined;
    description?: string | undefined;
    location?: string | undefined;
    colorId?: string | undefined;
  }
): Promise<void> {
  const auth = await getCalendarClient();

  await googleFetch<unknown>(
    auth,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    }
  );
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  const auth = await getCalendarClient();

  await googleFetch<unknown>(
    auth,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
    }
  );
}

export async function fetchGoogleCalendarEvents(
  timeMin: string,
  timeMax: string
): Promise<CalendarEventItem[]> {
  const auth = await getCalendarClient();

  const params = new URLSearchParams({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "2500",
  });

  const events = await googleFetch<CalendarEventsResponse>(
    auth,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`
  );

  return (events.items ?? []).map((evt) => ({
    id: evt.id ?? "",
    summary: evt.summary ?? "(Sans titre)",
    start: evt.start?.dateTime ?? evt.start?.date ?? timeMin,
    end: evt.end?.dateTime ?? evt.end?.date ?? timeMax,
    location: evt.location ?? undefined,
    description: evt.description ?? undefined,
    colorId: evt.colorId ?? undefined,
  }));
}

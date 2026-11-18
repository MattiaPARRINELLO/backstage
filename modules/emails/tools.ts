import { z } from "zod";
import { defineTool, toolEmpty, toolOk } from "@backstage/module-kit";

import { fetchGmailMessages, sendGmailReply } from "@/lib/google-actions";
import { invalidateServerCachePattern } from "@/lib/server-cache";

/**
 * Gmail : lecture, reponse et tri.
 *
 * La reponse est le seul outil du depot qui exige une confirmation permanente :
 * `external` sans surcharge. Les lectures sont non fiables, car leur texte vient
 * de l'exterieur et peut contenir des instructions.
 */

export const searchEmailsTool = defineTool({
  name: "search",
  description:
    "Recupere les emails Gmail (recus et envoyes) et cherche par mot-cle dans les expediteurs, destinataires, sujets ou contenus. Utilise 'in:sent' pour les mails envoyes, 'is:unread' pour les non-lus. Renvoie au maximum 10 messages, tries par date decroissante (le plus recent d'abord) ; sans mot-cle, ce sont donc les 10 derniers emails.",
  params: z.object({
    query: z.string().optional(),
  }),
  sideEffect: "read",
  trust: "untrusted",
  run: async (args) => {
    const emails = await fetchGmailMessages(args.query, 10);
    if (emails.length === 0) return toolEmpty("Aucun email trouve.");

    return toolOk(
      emails
        .map((email) => {
          const contact = email.to ? `De: ${email.from}\nA: ${email.to}` : `De: ${email.from}`;
          return `ID: ${email.id}\n${contact}\nSujet: ${email.subject}\nDate: ${email.date}\nExtrait: ${email.snippet}`;
        })
        .join("\n\n---\n\n")
    );
  },
});

export const replyEmailTool = defineTool({
  name: "reply",
  description: "Envoie une reponse a un email existant via Gmail.",
  params: z.object({
    email_id: z.string().min(1, "Identifiant de l'email requis"),
    response_text: z.string().min(1, "Texte de reponse requis"),
  }),
  sideEffect: "external",
  describeAction: (args) =>
    `Répondre à l'email ${String(args.email_id ?? "?")} : « ${String(
      args.response_text ?? ""
    ).slice(0, 140)}${String(args.response_text ?? "").length > 140 ? "…" : ""} »`,
  run: async (args) => {
    const sentId = await sendGmailReply(args.email_id, args.response_text);
    invalidateServerCachePattern(/^gmail:list/);
    return toolOk(`Reponse envoyee (message id: ${sentId}).`);
  },
});

export const triageEmailsTool = defineTool({
  name: "triage",
  description:
    "Analyse les emails non lus et les classe par priorite (urgent, newsletter, billetterie, personnel).",
  params: z.object({
    max_results: z.number().int().min(1).max(50).optional(),
  }),
  sideEffect: "read",
  trust: "untrusted",
  run: async (args) => {
    const emails = await fetchGmailMessages(undefined, args.max_results ?? 10);
    if (emails.length === 0) return toolEmpty("Aucun email trouve.");

    const urgent = emails.filter(
      (email) =>
        email.unread && /urgent|rappel|relance|deadline|échéance/i.test(`${email.subject} ${email.snippet}`)
    );
    const normal = emails.filter((email) => !urgent.includes(email));

    let result = "";
    if (urgent.length > 0) {
      result +=
        "🔴 URGENT :\n" + urgent.map((email) => `  - ${email.from}: ${email.subject}`).join("\n") + "\n\n";
    }
    result +=
      "📋 Autres emails :\n" +
      normal
        .map((email) => `  - ${email.from}: ${email.subject}${email.unread ? " (non lu)" : ""}`)
        .join("\n");
    return toolOk(result);
  },
});

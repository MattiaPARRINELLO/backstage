import type { ModuleContext } from "@backstage/module-kit";

import { chatCompletion } from "@/lib/ai-providers";
import { groqJson, groqJsonDelayMs, isGroqConfigured } from "@/lib/ai-providers/groq";
import { getModel } from "@/lib/app-config";
import {
  fetchGmailMessage,
  fetchGmailThread,
  fetchGmailThreads,
} from "@/lib/google-actions";
import { sendPushToAll } from "@/lib/push-dispatch";
import { logActivity } from "@/lib/storage";
import { isSafeFetchUrl, safeFetchText } from "@/lib/web";

import { emit } from "./events";

/**
 * Contexte fourni par le noyau à tout ce qu'un module exécute.
 *
 * Le module reçoit des moyens d'agir (log, événement, journal d'activité) mais
 * aucun accès direct à la requête, à la session ou au disque : ces accès
 * restent dans le noyau, qui décide de ce qu'il expose.
 */
export function createModuleContext(
  moduleId: string,
  options: { userId?: string } = {}
): ModuleContext {
  return {
    moduleId,
    // `exactOptionalPropertyTypes` distingue « absent » de « undefined » : on
    // n'ajoute la cle que lorsqu'un utilisateur existe vraiment.
    ...(options.userId ? { userId: options.userId } : {}),
    log: (level, message, error) => {
      const line = `[${moduleId}] ${message}`;
      if (level === "error") console.error(line, error);
      else if (level === "warn") console.warn(line, error);
      else console.log(line, error ?? "");
    },
    emit,
    activity: async (type, message, detail?: string) => {
      // Le module nomme son activité librement ; le noyau la range dans le
      // journal d'activité existant, qui a sa propre liste de types.
      await logActivity(
        type as Parameters<typeof logActivity>[0],
        message,
        detail
      );
    },
    ai: {
      // Le modèle vient des reglages applicatifs, jamais du module : un module
      // ne choisit ni le fournisseur ni le cout d'un appel.
      jsonDelayMs: groqJsonDelayMs(),
      complete: async ({ system, prompt, maxChars = 2000 }) => {
        const { primary: model } = await getModel("general");
        const messages = system
          ? [
              { role: "system" as const, content: system },
              { role: "user" as const, content: prompt },
            ]
          : [{ role: "user" as const, content: prompt }];
        const result = await chatCompletion(model, messages, []);
        return result.content.slice(0, maxChars).trim();
      },
      // Tache courte et structuree : Groq quand il est configure, sinon le
      // modele de conversation. Le module ne voit que le resultat.
      json: async ({ system, prompt, maxChars = 2000 }) => {
        if (isGroqConfigured()) {
          const raw = await groqJson(system, prompt);
          return raw.slice(0, maxChars).trim();
        }
        const { primary: model } = await getModel("general");
        const result = await chatCompletion(
          model,
          [
            { role: "system" as const, content: system },
            { role: "user" as const, content: prompt },
          ],
          []
        );
        return result.content.slice(0, maxChars).trim();
      },
    },
    net: {
      isSafeUrl: (url) => isSafeFetchUrl(url),
      // `safeFetchText` leve sur URL refusee, echec HTTP ou corps trop gros :
      // le contrat du kit rend `null` plutot que de laisser fuir une exception.
      fetchText: async (url, timeoutMs = 8000) => {
        try {
          return await safeFetchText(url, timeoutMs);
        } catch {
          return null;
        }
      },
    },
    notify: async ({ title, body, url, tag, data }) => {
      const payload = JSON.stringify({
        title,
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        requireInteraction: true,
        renotify: true,
        ...(tag ? { tag } : {}),
        data: { ...(data ?? {}), ...(url ? { url } : {}) },
      });
      const { sent } = await sendPushToAll(payload);
      return sent;
    },
    mail: {
      listThreads: (query, maxThreads) => fetchGmailThreads(query, maxThreads),
      getThread: (threadId) => fetchGmailThread(threadId),
      getMessage: (messageId) => fetchGmailMessage(messageId),
    },
  };
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  streamChatCompletion,
  chatCompletion,
  type UnifiedMessage,
  type StreamEvent,
} from "@/lib/ai-providers";
import {
  fetchPageMeta,
  autoSummarize,
  appendAssistantTurn,
} from "@/lib/storage";
import { createRun, publish, subscribe, finishRun } from "@/lib/chat-runs";
import { getModel } from "@/lib/config";
import { DEFAULT_SESSION_ID } from "@/lib/ai-providers/config";
import type { ChatMessage, MemoryCategory } from "@/lib/types";
import { getSession } from "@/lib/session";
import {
  listFactsForExtractionPrompt,
  parseExtractedFacts,
  persistExtractedFacts,
} from "@/lib/memory-autosave";
import { checkRateLimit } from "@/lib/rate-limit";
import { runTool, tools, REQUIRE_CONFIRMATION, confirmationMessage } from "@/lib/chat-tools";
import type { ToolRunResult } from "@/lib/chat-tools";
import { parseToolText, isFailedStatus, renderToolText, TOOL_HONESTY_RULE } from "@/lib/tool-result";
import { buildSystemPrompt } from "@/lib/chat-prompts";
import { serverLog } from "@/lib/logger";







const chatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().optional(),
        toolCalls: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              arguments: z.string(),
            })
          )
          .optional(),
      })
    )
    .min(1, "Au moins un message est requis"),
  model: z.enum(["general", "code"]).optional(),
  sessionId: z.string().trim().min(1).max(200).optional(),
});

// Consigne injectée après un résultat d'outil en échec ou bloqué : force le
// modèle à rendre compte fidèlement au lieu d'annoncer une action non faite.
const RESULT_HONESTY_RULE = TOOL_HONESTY_RULE;

function parseToolArguments(argumentsRaw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsRaw);
  } catch {
    throw new Error("arguments d'outil invalides (JSON)");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("arguments d'outil invalides (JSON)");
  }
  return parsed as Record<string, unknown>;
}

// Libellé lisible d'une action en attente de confirmation (aucun argument
// affiché intégralement, confidentialité). Reflet serveur de
// `describeAction` côté client (ChatView) pour le résumé du lot.
function describeToolAction(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "send_email_response":
      return `Répondre à l'email ${String(args.email_id ?? "?")}`;
    case "create_calendar_event":
      return `Créer l'événement « ${String(args.title ?? "")} » du ${String(args.start_time ?? "?")} au ${String(args.end_time ?? "?")}`;
    case "update_calendar_event":
      return `Modifier l'événement ${String(args.event_id ?? "?")}${args.title ? ` → « ${String(args.title)} »` : ""}`;
    case "delete_calendar_event":
      return `Supprimer l'événement ${String(args.event_id ?? "?")}`;
    case "schedule_followup":
      return `Programmer une relance « ${String(args.subject ?? "")} » pour le ${String(args.due_at ?? "?")}`;
    case "scan_accreditations":
      return "Analyser les emails pour créer ou mettre à jour les fiches d'accréditations";
    default:
      return name;
  }
}

// Résumé rédigé par l'IA des actions à confirmer d'un lot. Une seule carte de
// confirmation est affichée pour le lot entier ; ce résumé en donne la
// synthèse. En cas d'échec du passage modèle, on retombe sur une suite de
// descriptions lisibles (jamais sur une carte vide).
async function summarizeConfirmBatch(
  model: string,
  actions: { name: string; arguments: string }[],
  describe: (name: string, args: Record<string, unknown>) => string,
  sessionId: string
): Promise<string> {
  const lines = actions.map((a) => {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(a.arguments); } catch {}
    return `- ${describe(a.name, args)}`;
  });
  const fallback = lines.join("\n");
  try {
    const result = await chatCompletion(
      model,
      [
        { role: "system", content: "Tu resumes en une ou deux phrases concises le lot d'actions ci-dessous que tu t'appretes a soumettre a la confirmation de l'utilisateur. Phrase fluide, factuelle, sans enumeration lourde, sans markdown ni preambule. Commence directement par le resume." },
        { role: "user", content: `Actions a confirmer :\n${fallback}` },
      ],
      [],
      undefined,
      sessionId
    );
    const summary = result.content?.trim();
    return summary && summary.length > 2 ? summary : fallback;
  } catch (err) {
    void serverLog("chat", "warn", "Confirm batch summary failed, using fallback", err, true);
    return fallback;
  }
}


// Le dernier résultat d'outil est-il un échec ou un blocage ? Si oui, la
// réponse finale du modèle risque d'annoncer une action non réalisée. Le
// marqueur `[ERREUR]` / `[BLOQUE]` fait foi — pas la formulation du texte.
function lastToolResultIsProblematic(messages: UnifiedMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "tool") continue;
    const inner = (m.content ?? "")
      .replace(/^<tool_result[^>]*>\s*/, "")
      .replace(/<\/tool_result>\s*$/, "")
      .trim();
    return isFailedStatus(parseToolText(inner).status);
  }
  return false;
}



async function extractMemoryFacts(
  model: string,
  transcript: { role: "user" | "assistant"; content: string }[],
  sessionId: string
): Promise<{ content: string; category: MemoryCategory; confidence: number }[]> {
  const sysPrompt = `Tu es un extracteur de memoire pour un second cerveau personnel.
Analyse l'echange ci-dessous et extrais UNIQUEMENT les faits durables, stables et utiles a long terme sur l'utilisateur.
Categories autorisees: dev (preferences/competences techniques), photo (materiel, style, workflow), life (habitudes, contraintes, contexte personnel), preference (preferences generales).
Exclure: demandes ponctuelles, salutations, questions ephemeres, opinions changeantes.
Exclure aussi tout fait deja present dans la liste "Deja en memoire" ci-dessous : ne le repete pas.
Format de sortie STRICT: une ligne par fait au format "- [categorie] [confiance entre 0 et 1] enonce court".
Si rien de nouveau n'est memorisable, retourne EXACTEMENT: NONE
Pas de markdown, pas de numerotation, pas de preambule.`;

  // Faits deja connus : injectes pour eviter que le modele re-extrait en boucle
  // la meme information a chaque tour.
  const knownFacts = await listFactsForExtractionPrompt();

  const userPrompt = `Echange recent (les 6 derniers messages) :
${transcript
    .slice(-6)
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n")}
${knownFacts ? `\nDeja en memoire (ne pas repeter) :\n${knownFacts}\n` : ""}
Faits a extraire :`;

  try {
    const { chatCompletion } = await import("@/lib/ai-providers");
    const result = await chatCompletion(
      model,
      [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt },
      ],
      [],
      undefined,
      sessionId
    );

    // Parsing tolerant (puces, gras, virgule decimale, pourcentage) : un
    // ecart de format du modele ne doit plus faire perdre les faits.
    return parseExtractedFacts(result.content);
  } catch (err) {
    void serverLog("chat", "error", "Memory extraction failed", err, true);
    return [];
  }
}

async function runMemoryExtraction(
  model: string,
  originalMessages: ChatMessage[],
  sessionId: string,
  send?: (data: StreamEvent) => void,
  newAssistantContent?: string
): Promise<void> {
  try {
    const transcript = originalMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter((m) => typeof m.content === "string" && m.content.length > 0)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }));
    if (newAssistantContent && newAssistantContent.length > 0) {
      transcript.push({ role: "assistant", content: newAssistantContent });
    }
    if (transcript.length < 2) return;
    const lastUser = [...transcript].reverse().find((m) => m.role === "user");
    if (!lastUser || lastUser.content.length < 12) return;
    const lastAssistant = [...transcript].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant || lastAssistant.content.length < 24) return;

    const facts = await extractMemoryFacts(model, transcript, sessionId);
    if (facts.length === 0) return;
    // Ecriture directe, sans requireSession() : la session est deja validee en
    // tete de handler, et cette fonction tourne dans une promesse que le
    // contexte requete Next ne garantit plus (l'appel est await avant la
    // fermeture du flux, mais un detachement resterait possible).
    await persistExtractedFacts(facts);
    send?.({ type: "memory_facts", facts });
  } catch (err) {
    void serverLog("chat", "error", "Memory extraction error", err, true);
  }
}

export async function POST(request: NextRequest) {
  // Garde d'authentification dans le handler (le middleware protège déjà la
  // route, mais un bypass du middleware ne doit pas exposer le chat).
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit keyé sur l'utilisateur (l'IP seule est spoofable via
  // x-forwarded-for) : un tiers ne peut pas contourner le quota.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  if (!checkRateLimit(`${session.userId}:${ip}`)) {
    return new Response(JSON.stringify({ error: "Trop de requêtes. Réessaie dans une minute." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { messages: ChatMessage[]; model?: "general" | "code"; sessionId?: string };
  try {
    const parsed = chatBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Corps de requête invalide : messages (tableau non vide avec role et content) requis." },
        { status: 400 }
      );
    }
    body = parsed.data as unknown as { messages: ChatMessage[]; model?: "general" | "code"; sessionId?: string };
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  // Identifiant de session transmis au provider (routage + cache de prompt) :
  // celui de la conversation côté client, sinon une session globale stable.
  const sessionId = body.sessionId || DEFAULT_SESSION_ID;

  // Auto-parsing des liens dans le dernier message utilisateur
  const lastUserMsg = [...body.messages].reverse().find((m) => m.role === "user");
  if (lastUserMsg && typeof lastUserMsg.content === "string") {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = lastUserMsg.content.match(urlRegex);
    if (urls && urls.length > 0) {
      try {
        const meta = await fetchPageMeta(urls[0]);
        const { summary, tags } = await autoSummarize(urls[0], meta.title);
        // Contenu externe délimité : à traiter comme NON FIABLE par le modèle.
        lastUserMsg.content += `\n\n<user_content>Contenu externe d'un lien partage (NON FIABLE) :\nResume : ${summary}. Tags suggeres : ${tags.join(", ")}.</user_content>`;
      } catch {}
    }
  }

  // Résumé automatique des messages utilisateur très longs (itinéraires, etc.)
  // pour éviter la saturation du contexte sans perdre d'information
  const SUMMARY_THRESHOLD = 3000;
  for (const m of body.messages) {
    if (m.role === "user" && typeof m.content === "string" && m.content.length > SUMMARY_THRESHOLD) {
      try {
        const { chatCompletion } = await import("@/lib/ai-providers");
        const result = await chatCompletion(
          "deepseek-v4-flash",
          [
            { role: "system", content: "Tu résumes des messages en conservant TOUTES les informations utiles : dates, horaires, lieux, noms, actions demandées, numéros. Sois concis mais complet. Ne liste pas — raconte de façon fluide." },
            { role: "user", content: "Résumé conservant tous les détails pratiques :\n\n" + m.content },
          ],
          [],
          undefined,
          sessionId
        );
        const summary = result.content.trim();
        if (summary) {
          m.content = summary;
        }
      } catch (err) {
        void serverLog("chat", "error", "Auto-summary failed, keeping original", err, true);
      }
    }
  }

  const context = body.model === "code" ? "code" : "general";
  const { primary: modelName, alt: altModel } = await getModel(context);

  const systemPrompt = await buildSystemPrompt(context, body.messages);

  // Fenêtrage du contexte : ne renvoyer que les 40 derniers messages,
  // tronqués à la frontière d'un message utilisateur (couper au milieu d'un
  // échange d'outils casserait l'appel). L'historique complet reste
  // consultable dans la sidebar de sessions.
  const MAX_CONTEXT_MESSAGES = 40;
  if (body.messages.length > MAX_CONTEXT_MESSAGES) {
    const windowed = body.messages.slice(-MAX_CONTEXT_MESSAGES);
    const firstUserIdx = windowed.findIndex((m) => m.role === "user");
    body.messages = firstUserIdx > 0 ? windowed.slice(firstUserIdx) : windowed;
  }

  const messages: UnifiedMessage[] = [
    { role: "system", content: systemPrompt },
    ...body.messages.map((m): UnifiedMessage => {
      const tool_calls = m.toolCalls?.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      }));
      return {
        role: m.role,
        content: (tool_calls && tool_calls.length > 0 && !m.content) ? null : m.content,
        ...(tool_calls && tool_calls.length > 0 ? { tool_calls } : {}),
      };
    }),
  ];

  const encoder = new TextEncoder();
  // Registre serveur : la génération survit à la déconnexion du client. Le
  // flux HTTP peut être annulé (navigation, onglet fermé), la boucle IA
  // continue et écrit la réponse dans l'historique.
  const run = createRun(sessionId);
  const abortController = run.controller;
  const lastUserContent =
    [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  let streamClosed = false;
  let generationStarted = false;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      generationStarted = true;
      // Abonnement du flux HTTP courant. `replay: false` : le client qui vient
      // d'envoyer la requête n'a pas besoin de l'instantané initial.
      unsubscribe = subscribe(
        run,
        (event) => {
          if (streamClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            streamClosed = true;
          }
        },
        false
      );

      function closeStream() {
        unsubscribe?.();
        unsubscribe = null;
        if (streamClosed) return;
        streamClosed = true;
        try {
          controller.close();
        } catch {
          // Déjà fermé côté client : sans conséquence.
        }
      }

      function send(data: StreamEvent) {
        // Met à jour l'instantané serveur puis diffuse aux abonnés (flux HTTP
        // courant et éventuels clients réattachés).
        publish(run, data);
      }

      const maxIterations = 20;

      // Evenement de fermeture dicte par le dernier passage du modele.
      // Envoye AVANT l'ecriture disque et l'extraction memoire : le tour est
      // termine pour le client, qui peut lire la reponse sans attendre.
      let pendingDone = "";
      let pendingError: StreamEvent | null = null;

      async function runModel(model: string): Promise<boolean> {
        const generator = streamChatCompletion(model, messages, tools, abortController.signal, sessionId);
        const toolCallsToExecute: { toolCallId: string; name: string; arguments: string }[] = [];
        let assistantContent = "";

        for await (const event of generator) {
          if (event.type === "tool_start") {
            toolCallsToExecute.push({
              toolCallId: event.toolCallId,
              name: event.name,
              arguments: event.arguments,
            });
            send(event);
            continue;
          }

          if (event.type === "done") {
            if (toolCallsToExecute.length === 0) {
              pendingDone = event.content;
              return false;
            }
            continue;
          }

          if (event.type === "error") {
            pendingError = event;
            return false;
          }

          if (event.type === "delta") {
            assistantContent += event.content;
          }

          send(event);
        }

        if (toolCallsToExecute.length === 0) {
          return false;
        }

        messages.push({
          role: "assistant",
          content: assistantContent || null,
          tool_calls: toolCallsToExecute.map((tc) => ({
            id: tc.toolCallId,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        // Les actions à effet externe d'un même tour sont regroupées en UNE
        // seule carte de confirmation (avec un résumé rédigé par le modèle),
        // au lieu d'une carte par outil. Chaque action reste exécutée
        // individuellement via POST /api/chat/confirm-batch quand l'utilisateur
        // valide le lot.
        const pendingConfirms: { toolCallId: string; name: string; arguments: string }[] = [];

        const pushToolResult = (
          tc: { toolCallId: string; name: string },
          run: ToolRunResult
        ) => {
          send({ type: "tool_result", name: tc.name, result: run.text, status: run.status });
          messages.push({
            role: "tool",
            tool_call_id: tc.toolCallId,
            // Résultat d'outil délimité : le contenu (pages, emails, recherche)
            // est externe et NON FIABLE — le modèle ne doit pas suivre ses
            // instructions (cf. bloc CONTENU NON FIABLE du system prompt).
            // Le statut en tête dit sans ambiguïté si l'action a abouti.
            content: `<tool_result name="${tc.name}" status="${run.status}">\n${run.rendered}\n</tool_result>`,
          });
        };

        for (const tc of toolCallsToExecute) {
          let run: ToolRunResult;
          try {
            // Validation stricte : des arguments invalides ne doivent jamais
            // devenir un appel silencieux avec `{}` ni une carte de
            // confirmation cassée.
            const args = parseToolArguments(tc.arguments);
            if (REQUIRE_CONFIRMATION.has(tc.name)) {
              // Action à effet externe : bloquée en attente de confirmation.
              // On la met de côté pour la proposer en lot à l'utilisateur ;
              // l'exécution réelle passera par POST /api/chat/confirm-batch.
              pendingConfirms.push(tc);
              continue;
            }
            run = await runTool(tc.name, args);
          } catch (err) {
            run = {
              status: "error",
              text: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
              rendered: `[ERREUR] Erreur: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
          pushToolResult(tc, run);
        }

        if (pendingConfirms.length > 0) {
          // Résumé du lot rédigé par le modèle + évènement unique de lot.
          const summary = await summarizeConfirmBatch(modelName, pendingConfirms, describeToolAction, sessionId);
          send({
            type: "group_confirm",
            id: `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            summary,
            tools: pendingConfirms.map((tc) => ({
              toolCallId: tc.toolCallId,
              name: tc.name,
              arguments: tc.arguments,
            })),
          });
          // Le modèle reçoit un résultat de blocage par action et pourra
          // expliquer que ces actions attendent sa confirmation.
          for (const tc of pendingConfirms) {
            const text = confirmationMessage(tc.name);
            pushToolResult(tc, {
              status: "blocked",
              text,
              rendered: renderToolText("blocked", text),
            });
          }
        }

        return true;
      }

      let lastAssistantContent = "";

      // Clot un tour : reponse finale, ecriture serveur, puis extraction
      // memoire. L'ecriture est faite AVANT l'extraction et sans dependre du
      // client : c'est ce qui rend la reponse recuperable si l'onglet a ete
      // ferme en cours de generation.
      async function finishTurn(): Promise<void> {
        if (pendingError) send(pendingError);
        send({ type: "done", content: pendingDone });

        const finalContent = run.content || pendingDone || lastAssistantContent;
        await persistTurn(finalContent);
        finishRun(run, finalContent);
        // L'extraction memoire reste ATTENDUE et inconditionnelle : c'est ce
        // qui garantit que les faits sont ecrits avant la fin de la requete.
        // Le flux HTTP reste ouvert jusque-la pour le toast « faits memorises ».
        await runMemoryExtraction(modelName, body.messages, sessionId, send, lastAssistantContent);
        closeStream();
      }

      // Ecriture de la reponse dans l'historique. Tolerance aux erreurs : un
      // echec de persistance ne doit pas transformer une generation reussie en
      // erreur affichee a l'utilisateur.
      async function persistTurn(content: string): Promise<void> {
        if (!content.trim() && run.tools.length === 0) return;
        try {
          await appendAssistantTurn({
            sessionId,
            userContent: lastUserContent,
            assistantContent: content,
            toolCalls: run.tools,
          });
        } catch (err) {
          void serverLog("chat", "error", "Persist turn failed", err, true);
        }
      }

      try {
        let useFallback = false;
        for (let i = 0; i < maxIterations; i++) {
          const currentModel = useFallback ? altModel : modelName;

          try {
            const shouldContinue = await runModel(currentModel);
            if (!shouldContinue) {
              await finishTurn();
              return;
            }
            const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
            if (lastAssistantMsg && typeof lastAssistantMsg.content === "string") {
              lastAssistantContent = lastAssistantMsg.content;
            }
            // Garde-fou : si le dernier résultat d'outil est un échec ou un
            // blocage, rappeler au modèle avant sa réponse finale de ne pas
            // annoncer une action non réalisée.
            if (lastToolResultIsProblematic(messages)) {
              messages.push({ role: "system", content: RESULT_HONESTY_RULE });
            }
          } catch (err) {
            // Arrêt explicite (bouton Stop, nouvelle requête) : plus de
            // fallback inutile.
            if (run.aborted) throw err;
            void serverLog("chat", "error", `runModel(${currentModel}) failed`, err);
            // Pas de fallback réel si le modèle de secours est identique au
            // principal : remonter l'erreur d'origine plutôt qu'un faux
            // « a échoué après fallback » sans seconde chance véritable.
            if (useFallback || currentModel === altModel) throw err;
            useFallback = true;
            continue;
          }
          useFallback = false;
        }

        await finishTurn();
      } catch (error) {
        // Arrêt explicite : on conserve la réponse partielle déjà streamée.
        if (run.aborted) {
          await persistTurn(run.content);
          finishRun(run, run.content);
          closeStream();
          return;
        }
        void serverLog("chat", "error", "Chat stream error", error);
        const message = error instanceof Error ? error.message : "Erreur inconnue";
        send({ type: "error", message });
        send({ type: "done", content: "" });
        finishRun(run, run.content);
        closeStream();
      }
    },
    cancel() {
      // Le client a fermé la connexion (navigation, onglet fermé, réseau) :
      // on ne coupe PAS la génération. Elle continue côté serveur, écrit sa
      // réponse dans l'historique et reste récupérable via
      // GET /api/chat/stream. Seul /api/chat/stop l'interrompt.
      streamClosed = true;
      unsubscribe?.();
      unsubscribe = null;
      // Le flux a été annulé avant même que la génération démarre : aucun tour
      // ne viendra le clôturer, on libère le run tout de suite.
      if (!generationStarted) finishRun(run);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

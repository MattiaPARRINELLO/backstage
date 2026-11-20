"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useChatContext } from "@/lib/chat-context";
import { useToast } from "@/components/ui/Toast";
import type { ActivityStep, Message, ToolCall } from "@/components/chat/types";
import type { ChatSession } from "@/lib/types";
import {
  FUNNY_THOUGHTS,
  welcomeMessage,
  generateId,
  generateTitle,
  formatQuotedMessage,
  type MessageQuote,
} from "@/components/chat/chat-data";
import { SelectionCommentLayer } from "@/components/chat/SelectionComment";
import {
  getLiveRun,
  subscribeLiveRun,
  startLiveRun,
  abortLiveRun,
  resumeLiveRun,
  clearLiveRun,
  type LiveRunEvent,
} from "@/components/chat/live-run";
import { type PendingActionReason } from "@/lib/tool-result";
import { buildActionContext } from "@/lib/chat-action-context";
import { GroupActionCard } from "@/components/chat/MessageBlocks";
import { ChatTranscript } from "@/components/chat/ChatTranscript";
import { useChatAutoscroll } from "@/components/chat/use-chat-autoscroll";
import { useChatShortcuts } from "@/components/chat/use-chat-shortcuts";
import { KeyboardSafe } from "@/components/ui/KeyboardSafe";

// Résumé lisible d'une action IA en attente de confirmation, pour la carte
// Confirmer/Annuler. Aucun argument n'est affiché intégralement (confidentialité).
function describeAction(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "send_email_response":
      return `Répondre à l'email ${String(args.email_id ?? "?")} : « ${String(args.response_text ?? "").slice(0, 140)}${String(args.response_text ?? "").length > 140 ? "…" : ""} »`;
    case "emails.reply":
      return `Répondre à l'email ${String(args.email_id ?? "?")} : « ${String(args.response_text ?? "").slice(0, 140)}${String(args.response_text ?? "").length > 140 ? "…" : ""} »`;
    case "create_calendar_event":
      return `Créer l'événement « ${String(args.title ?? "")} » du ${String(args.start_time ?? "?")} au ${String(args.end_time ?? "?")}${args.location ? ` (${String(args.location)})` : ""}`;
    case "calendar.create":
      return `Créer l'événement « ${String(args.title ?? "")} » du ${String(args.start_time ?? "?")} au ${String(args.end_time ?? "?")}${args.location ? ` (${String(args.location)})` : ""}`;
    case "update_calendar_event":
      return `Modifier l'événement ${String(args.event_id ?? "?")}${args.title ? ` → « ${String(args.title)} »` : ""}`;
    case "calendar.update":
      return `Modifier l'événement ${String(args.event_id ?? "?")}${args.title ? ` → « ${String(args.title)} »` : ""}`;
    case "delete_calendar_event":
      return `Supprimer l'événement ${String(args.event_id ?? "?")}`;
    case "calendar.delete":
      return `Supprimer l'événement ${String(args.event_id ?? "?")}`;
    case "schedule_followup":
      return `Programmer une relance « ${String(args.subject ?? "")} » pour le ${String(args.due_at ?? "?")}`;
    case "followups.schedule":
      return `Programmer une relance « ${String(args.subject ?? "")} » pour le ${String(args.due_at ?? "?")}`;
    case "scan_accreditations":
      return "Analyser les emails pour créer ou mettre à jour les fiches d'accréditations";
    case "accreditations.scan":
      return "Analyser les emails pour créer ou mettre à jour les fiches d'accréditations";
    default:
      return "";
  }
}

interface ChatViewProps {
  sessionId?: string;
  resetSignal?: number;
  onSessionChange?: (sessionId: string) => void;
}

export function ChatView({ sessionId: externalSessionId, resetSignal = 0, onSessionChange }: ChatViewProps = {}) {
  const [messages, setMessages] = useState<Message[]>(() =>
    typeof window !== "undefined"
      ? [welcomeMessage]
      : [welcomeMessage]
  );
  const [input, setInput] = useState("");
  // Extraits commentés (sélection dans une réponse de l'IA) en attente d'envoi.
  const [pendingQuotes, setPendingQuotes] = useState<MessageQuote[]>([]);
  // Dernier extrait ajouté : il « atterrit » avec une animation dans le champ.
  const [highlightedQuoteId, setHighlightedQuoteId] = useState<string | null>(null);
  const quoteAnimRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingGroups, setPendingGroups] = useState<
    {
      id: string;
      summary: string;
      reason: PendingActionReason;
      tools: { toolCallId: string; name: string; args: Record<string, unknown>; argsLabel: string }[];
    }[]
  >([]);
  const [confirmBusy, setConfirmBusy] = useState<string | null>(null);
  const [thinkingIndex, setThinkingIndex] = useState(() => Math.floor(Math.random() * FUNNY_THOUGHTS.length));
  const chatCtx = useChatContext();
  const toast = useToast();
  const activeToolsRef = useRef<Record<string, ToolCall>>({});

  // Fil d'activité du tour en cours : pensées et outils, dans l'ordre.
  const [liveSteps, setLiveSteps] = useState<ActivityStep[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingActive, setStreamingActive] = useState(false);
  const streamingActiveRef = useRef(false);
  const [sessionId, setSessionId] = useState<string>(() => generateId());
  const [sessionTitle, setSessionTitle] = useState<string>("");

  const loadSeqRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  useChatAutoscroll({ scrollRef, messages, streamingContent });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTitleRef = useRef(false);
  const prevExternalSessionIdRef = useRef<string>("");
  const prevSessionIdRef = useRef(sessionId);
  // État du tour en cours, en refs : il doit survivre aux re-rendus et être
  // rejouable tel quel quand on se réattache à une génération.
  const bufferRef = useRef("");
  const finishedToolsRef = useRef<ToolCall[]>([]);
  const liveStepsRef = useRef<ActivityStep[]>([]);
  const toolStartsRef = useRef<Record<string, number>>({});
  const appliedEventsRef = useRef(0);
  const turnStartRef = useRef(0);
  const messagesRef = useRef<Message[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Le minuteur d'animation du dernier extrait ne doit pas survivre au
  // démontage de la vue.
  useEffect(
    () => () => {
      if (quoteAnimRef.current) clearTimeout(quoteAnimRef.current);
    },
    []
  );

  // Remet à zéro l'état du tour en cours (texte, outils, fil d'activité).
  // Appelé à chaque nouveau tour, changement de session et arrêt.
  const resetTurnState = useCallback(() => {
    bufferRef.current = "";
    finishedToolsRef.current = [];
    liveStepsRef.current = [];
    toolStartsRef.current = {};
    activeToolsRef.current = {};
    setLiveSteps([]);
    setStreamingContent("");
    streamingActiveRef.current = false;
    setStreamingActive(false);
  }, []);

  // Consentement IA : rien n'est envoyé au provider tant que l'utilisateur
  // n'a pas accepté l'écran de consentement (voir /privacy).
  const [consent, setConsent] = useState<{ loaded: boolean; accepted: boolean }>({
    loaded: false,
    accepted: false,
  });

  useEffect(() => {
    let cancelled = false;
    import("@/app/actions/consent")
      .then(({ loadAiConsent }) => loadAiConsent())
      .then((state) => {
        if (!cancelled) setConsent({ loaded: true, accepted: state.aiConsent });
      })
      .catch(() => {
        if (!cancelled) setConsent({ loaded: true, accepted: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const acceptConsent = async () => {
    try {
      const { acceptAiConsent } = await import("@/app/actions/consent");
      await acceptAiConsent(true);
      setConsent({ loaded: true, accepted: true });
    } catch {
      setConsent({ loaded: true, accepted: false });
    }
  };

  function restoreMessages(raw: ChatSession["messages"]): Message[] {
    const restored: Message[] = raw.map((m) => ({
      ...m,
      toolCalls: m.toolCalls?.map((tc) => ({
        ...tc,
        status: (tc.status as ToolCall["status"]) || "success",
      })),
      steps: m.steps?.map((step) =>
        step.kind === "tool"
          ? { ...step, status: (step.status as ToolCall["status"]) || "success" }
          : step
      ),
    }));
    return restored.length > 0 ? restored : [welcomeMessage];
  }

  // Démonter la vue (changement de page) n'annule PLUS la génération : elle est
  // portée par `live-run.ts`, hors React, et le serveur la poursuit de toute
  // façon. Seuls Stop / Esc / « nouvelle conversation » l'interrompent.

  useEffect(() => {
    if (externalSessionId && externalSessionId !== prevExternalSessionIdRef.current) {
      prevExternalSessionIdRef.current = externalSessionId;
      // Garde anti-race : si l'utilisateur change rapidement de session, seule
      // la dernière demande de chargement doit appliquer son résultat.
      const seq = ++loadSeqRef.current;
      import("@/app/actions/chat-history").then(({ getChatHistory }) => {
        getChatHistory().then((history) => {
          if (seq !== loadSeqRef.current) return;
          const session = history.sessions.find((s) => s.id === externalSessionId);
          if (session) {
            const restored = restoreMessages(session.messages);
            // Le message utilisateur du tour en cours peut ne pas encore être
            // dans l'historique (sauvegarde client différée de 2 s, ou onglet
            // fermé juste après l'envoi) : le gestionnaire de génération le
            // détient, on le réinjecte pour ne pas le perdre à l'écran.
            const live = getLiveRun(session.id);
            let display = restored;
            if (live?.userMessage && !restored.some((m) => m.id === live.userMessage!.id)) {
              const base = restored.length === 1 && restored[0].id === "welcome" ? [] : restored;
              display = [...base, live.userMessage];
            }
            setSessionId(session.id);
            setSessionTitle(session.title || "");
            hasTitleRef.current = true;
            setMessages(display);
            setInput("");
            setPendingQuotes([]);
            resetTurnState();
            appliedEventsRef.current = 0;
            setLoading(false);
            setError(null);
            setPendingGroups([]);
            activeToolsRef.current = {};
            chatCtx.clearActiveTools();
            // Si une génération tourne encore pour cette conversation, on s'y
            // réattache : le serveur rejoue un instantané puis la suite.
            void resumeLiveRun(session.id);
          }
        });
      });
    }
    // chatCtx est volontairement omis : sa valeur change à chaque outil actif
    // et rechargerait l'historique en écrasant les messages affichés.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSessionId]);

  useEffect(() => {
    if (resetSignal === 0) return;
    const previousSessionId = prevSessionIdRef.current;
    const newId = generateId();
    prevSessionIdRef.current = newId;
    // Reset complet de la conversation déclenché par une prop externe (resetSignal) :
    // c'est une synchronisation légitime avec un système externe (le parent ChatLayout).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionTitle("");
    hasTitleRef.current = false;
    setMessages([welcomeMessage]);
    setInput("");
    setPendingQuotes([]);
    resetTurnState();
    appliedEventsRef.current = 0;
    setLoading(false);
    setError(null);
    activeToolsRef.current = {};
    chatCtx.clearActiveTools();
    // « Nouvelle conversation » est une action explicite : on arrête le tour
    // en cours de l'ancienne.
    if (previousSessionId) {
      abortLiveRun(previousSessionId);
      clearLiveRun(previousSessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const saveSession = useCallback(() => {
    if (!sessionId) return;
    const filtered = messages.filter((m) => m.id !== "welcome");
    if (filtered.length === 0) return;
    const title = sessionTitle || (filtered[0]?.role === "user" ? generateTitle(filtered[0].content) : "Nouvelle conversation");
    import("@/app/actions/chat-history").then(({ saveChatSession }) => {
      saveChatSession({
        id: sessionId,
        title,
        messages: filtered.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          toolCalls: m.toolCalls?.map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments || "",
            result: tc.result,
            status: tc.status,
            duration: tc.duration,
            resultCount: tc.resultCount,
          })),
          steps: m.steps,
          activityMs: m.activityMs,
        })),
        createdAt: filtered[0]?.timestamp || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
  }, [messages, sessionId, sessionTitle]);

  // Recharge la conversation depuis l'historique serveur. Utilisé quand une
  // génération interrompue (app en arrière-plan) a fini côté serveur : la
  // réponse est persistée, il suffit de la relire.
  const reloadFromHistory = useCallback(async () => {
    if (!sessionId) return;
    const seq = ++loadSeqRef.current;
    try {
      const { getChatHistory } = await import("@/app/actions/chat-history");
      const history = await getChatHistory();
      if (seq !== loadSeqRef.current) return;
      const session = history.sessions.find((s) => s.id === sessionId);
      if (!session) return;
      const restored = restoreMessages(session.messages);
      setMessages(restored);
      resetTurnState();
      appliedEventsRef.current = getLiveRun(sessionId)?.events.length ?? 0;
      setLoading(false);
      activeToolsRef.current = {};
      chatCtx.clearActiveTools();
      // Dernier message utilisateur sans réponse : le tour a échoué avant
      // d'être persisté, on le signale au lieu de laisser croire qu'il tourne.
      const last = restored[restored.length - 1];
      if (last?.role === "user") {
        setError("La réponse a été interrompue. Renvoie ton message.");
      }
    } catch (err) {
      console.warn("[chat] rechargement de l'historique impossible", err);
    }
  }, [sessionId, chatCtx, resetTurnState]);

  useEffect(() => {
    if (!sessionId || messages.length <= 1 || messages[0]?.id === "welcome") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveSession, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, sessionId, saveSession]);

  useEffect(() => {
    // Rotation des pensées humoristiques : uniquement tant qu'aucune vraie
    // pensée ni aucun outil n'alimente le fil.
    if (loading && liveSteps.length === 0) {
      const interval = setInterval(() => {
        setThinkingIndex(Math.floor(Math.random() * FUNNY_THOUGHTS.length));
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [loading, liveSteps.length]);

  // Enregistre la réponse assistant en fin de tour. Idempotent : si la réponse
  // est déjà là (historique relu, serveur qui a persisté), on la remplace au
  // lieu d'en ajouter une seconde.
  const finishAssistant = useCallback((content: string) => {
    const toolCalls = finishedToolsRef.current;
    const steps = liveStepsRef.current;
    const activityMs =
      turnStartRef.current > 0 ? Date.now() - turnStartRef.current : undefined;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant") {
        return [
          ...prev.slice(0, -1),
          {
            ...last,
            content,
            toolCalls: toolCalls.length > 0 ? toolCalls : last.toolCalls,
            steps: steps.length > 0 ? steps : last.steps,
            activityMs: activityMs ?? last.activityMs,
          },
        ];
      }
      return [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content,
          timestamp: new Date().toISOString(),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          steps: steps.length > 0 ? steps : undefined,
          activityMs,
        },
      ];
    });
    activeToolsRef.current = {};
    finishedToolsRef.current = [];
    liveStepsRef.current = [];
    toolStartsRef.current = {};
    setLiveSteps([]);
    bufferRef.current = "";
    setStreamingContent("");
    streamingActiveRef.current = false;
    setStreamingActive(false);
    setLoading(false);

    if (hasTitleRef.current) {
      const firstUserMsg = messagesRef.current.find((m) => m.role === "user");
      if (firstUserMsg && firstUserMsg.content) {
        import("@/app/actions/chat-history").then(({ generateConversationTitle }) => {
          const fullText = firstUserMsg.content + "\n" + content;
          generateConversationTitle(fullText).then((aiTitle) => {
            if (aiTitle && aiTitle.length > 3) {
              setSessionTitle(aiTitle);
            }
          });
        });
      }
    }
  }, []);

  // Applique un évènement du flux à l'état affiché. Extrait de `send` pour être
  // rejoué à l'identique quand on se réattache à une génération en cours.
  const applyEvent = useCallback(
    (event: LiveRunEvent) => {
      if (event.type === "reasoning") {
        // Pensée du modèle : on l'ajoute au fil, en continu tant que la
        // dernière étape est une pensée (même règle que côté serveur).
        const steps = [...liveStepsRef.current];
        const last = steps[steps.length - 1];
        if (last?.kind === "thought") {
          steps[steps.length - 1] = {
            kind: "thought",
            text: (last.text + event.content).slice(0, 4000),
          };
        } else {
          steps.push({ kind: "thought", text: event.content.slice(0, 4000) });
        }
        liveStepsRef.current = steps;
        setLiveSteps(steps);
        return;
      }
      if (event.type === "delta") {
        bufferRef.current += event.content;
        setStreamingContent(bufferRef.current);
        if (!streamingActiveRef.current) {
          streamingActiveRef.current = true;
          setStreamingActive(true);
        }
      } else if (event.type === "tool_start") {
        activeToolsRef.current = {
          ...activeToolsRef.current,
          [event.toolCallId]: {
            id: event.toolCallId,
            name: event.name,
            arguments: event.arguments,
            status: "running",
          },
        };
        toolStartsRef.current[event.toolCallId] = Date.now();
        const steps: ActivityStep[] = [
          ...liveStepsRef.current,
          {
            kind: "tool",
            id: event.toolCallId,
            name: event.name,
            arguments: event.arguments,
            status: "running",
          },
        ];
        liveStepsRef.current = steps;
        setLiveSteps(steps);
        chatCtx.registerToolStart({ id: event.toolCallId, name: event.name, arguments: event.arguments });
      } else if (event.type === "tool_result") {
        const key = Object.keys(activeToolsRef.current).find(
          (k) => activeToolsRef.current[k].name === event.name
        );
        const existing = key ? activeToolsRef.current[key] : null;
        // Durée mesurée par outil, et non cumulée depuis le début du tour.
        const startedAt = existing ? toolStartsRef.current[existing.id] : undefined;
        const duration = startedAt ? (Date.now() - startedAt) / 1000 : 0;
        const resultCount = event.result
          ? event.result.split("\n").filter(Boolean).length
          : 0;
        // Statut serveur s'il est fourni ; sinon on retombe sur la
        // détection textuelle (messages d'historique plus anciens).
        const isError = event.status
          ? event.status === "error" || event.status === "blocked"
          : event.result.includes("Erreur");
        const status: "success" | "error" = isError ? "error" : "success";
        if (existing) {
          const remaining = { ...activeToolsRef.current };
          delete remaining[key!];
          activeToolsRef.current = remaining;
          delete toolStartsRef.current[existing.id];
          finishedToolsRef.current = [
            ...finishedToolsRef.current,
            {
              ...existing,
              result: event.result,
              status,
              duration,
              resultCount: resultCount || 1,
            },
          ];
          const steps = liveStepsRef.current.map((step) =>
            step.kind === "tool" && step.id === existing.id
              ? { ...step, result: event.result, status, duration, resultCount: resultCount || 1 }
              : step
          );
          liveStepsRef.current = steps;
          setLiveSteps(steps);
        }
        chatCtx.registerToolResult(event.name, event.result, isError, duration);
      } else if (event.type === "group_confirm") {
        setPendingGroups((prev) => [
          ...prev,
          {
            id: event.id,
            summary: event.summary,
            reason: event.reason,
            tools: event.tools.map((t) => {
              let args: Record<string, unknown> = {};
              try { args = JSON.parse(t.arguments); } catch { args = {}; }
              return {
                toolCallId: t.toolCallId,
                name: t.name,
                args,
                argsLabel: describeAction(t.name, args),
              };
            }),
          },
        ]);
      } else if (event.type === "error") {
        setError(event.message);
      } else if (event.type === "memory_facts") {
        const count = event.facts.length;
        if (count > 0) {
          toast.show({
            message: `${count} fait${count > 1 ? "s" : ""} mémorisé${count > 1 ? "s" : ""}`,
            tone: "info",
            duration: 3000,
          });
        }
      } else if (event.type === "snapshot") {
        // Reprise après navigation / réouverture d'onglet : on reconstruit
        // l'état affiché à partir de l'instantané serveur.
        bufferRef.current = event.content;
        finishedToolsRef.current = event.tools.map((t) => ({
          ...t,
          status: t.status ?? "success",
        }));
        activeToolsRef.current = Object.fromEntries(
          event.activeTools.map((t) => [t.id, { ...t, status: "running" as const }])
        );
        liveStepsRef.current = event.steps.map((step) =>
          step.kind === "tool"
            ? { ...step, status: step.status ?? "success" }
            : step
        );
        setLiveSteps(liveStepsRef.current);
        toolStartsRef.current = Object.fromEntries(
          event.activeTools.map((t) => [t.id, Date.now()])
        );
        chatCtx.clearActiveTools();
        for (const t of event.activeTools) {
          chatCtx.registerToolStart({
            id: t.id,
            name: t.name,
            arguments: t.arguments ?? "",
          });
        }
        setStreamingContent(event.content);
        streamingActiveRef.current = event.content.length > 0;
        setStreamingActive(event.content.length > 0);
        setPendingGroups(
          event.groups.map((g) => ({
            id: g.id,
            summary: g.summary,
            // Instantané d'un run antérieur à la raison : politique par défaut.
            reason: g.reason ?? "policy",
            tools: g.tools.map((t) => {
              let args: Record<string, unknown> = {};
              try { args = JSON.parse(t.arguments); } catch { args = {}; }
              return {
                toolCallId: t.toolCallId,
                name: t.name,
                args,
                argsLabel: describeAction(t.name, args),
              };
            }),
          }))
        );
        if (event.error) setError(event.error);
        if (event.finished) {
          setLoading(false);
          finishAssistant(event.doneContent ?? event.content);
        } else {
          setLoading(true);
        }
      } else if (event.type === "done") {
        finishAssistant(bufferRef.current || event.content || "");
      } else if (event.type === "reload") {
        // La génération a abouti côté serveur : on relit l'historique.
        void reloadFromHistory();
      } else if (event.type === "failed") {
        // Plus de réponse possible : on affiche ce qui a été reçu et on lève
        // l'état « en train d'écrire » au lieu de laisser tourner le spinner.
        if (bufferRef.current) finishAssistant(bufferRef.current);
        else {
          setLoading(false);
          streamingActiveRef.current = false;
          setStreamingActive(false);
          setStreamingContent("");
        }
        setError(event.message);
      }
    },
    [chatCtx, toast, finishAssistant, reloadFromHistory]
  );

  // Abonnement au gestionnaire de génération : les évènements arrivent même
  // quand la vue vient d'être remontée (rejeu complet depuis le début du tour).
  // `applyEvent` passe par une ref : sa valeur change à chaque outil actif, et
  // re-souscrire à ce moment-là rejouerait tout le tampon (texte dupliqué).
  const applyEventRef = useRef(applyEvent);
  useEffect(() => {
    applyEventRef.current = applyEvent;
  }, [applyEvent]);

  useEffect(() => {
    if (!sessionId) return;
    appliedEventsRef.current = 0;
    const apply = () => {
      const run = getLiveRun(sessionId);
      if (!run) return;
      if (appliedEventsRef.current > run.events.length) appliedEventsRef.current = 0;
      while (appliedEventsRef.current < run.events.length) {
        applyEventRef.current(run.events[appliedEventsRef.current]);
        appliedEventsRef.current += 1;
      }
      if (run.status !== "running" && appliedEventsRef.current >= run.events.length) {
        clearLiveRun(sessionId);
      }
    };
    const unsubscribe = subscribeLiveRun(sessionId, apply);
    apply();
    return unsubscribe;
  }, [sessionId]);

  const send = useCallback(
    async (text: string) => {
      // Les extraits commentés sont sérialisés dans le message : le modèle voit
      // la citation et la réaction, l'utilisateur retrouve les modules à
      // l'affichage (voir `parseQuotedMessage`).
      const trimmed = formatQuotedMessage(pendingQuotes, text).trim();
      if (!trimmed || loading) return;

      if (consent.loaded && !consent.accepted) {
        setError(
          "Accepte l'utilisation de l'IA pour envoyer des messages (bannière ci-dessus ou page Vie privée)."
        );
        return;
      }

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      if (!hasTitleRef.current) {
        import("@/app/actions/chat-history").then(({ generateConversationTitle }) => {
          generateConversationTitle(trimmed).then((title) => {
            setSessionTitle(title);
          });
        });
        const title = generateTitle(trimmed);
        setSessionTitle(title);
        hasTitleRef.current = true;
        prevExternalSessionIdRef.current = sessionId;
        if (onSessionChange && sessionId) onSessionChange(sessionId);
      }

      setInput("");
      setPendingQuotes([]);
      setError(null);
      activeToolsRef.current = {};
      resetTurnState();
      turnStartRef.current = Date.now();
      chatCtx.clearActiveTools();
      setPendingGroups([]);
      setLoading(true);

      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg];
      setMessages(next);

      const apiMessages = next
        .filter((m) => m.role !== "assistant" || m.content)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      // Résultats des actions à effet de bord (confirmées comprises) : sans ce
      // rappel, le modèle repart d'un contexte où il n'a aucune preuve que
      // l'action a bien été exécutée et peut affirmer qu'elle n'a pas eu lieu.
      // Une seule ligne par action, l'état le plus récent faisant foi (issue
      // #141 : un ancien [BLOQUE] ne doit jamais survivre à la confirmation).
      const actionContext = buildActionContext(next);

      // La génération est portée par `live-run.ts` (hors React) : un changement
      // de page ne l'interrompt plus. Le serveur la poursuit même si l'onglet
      // est fermé, et GET /api/chat/stream permet de s'y réattacher.
      startLiveRun({ sessionId, userMessage: userMsg, messages: apiMessages, actionContext });
    },
    [loading, messages, sessionId, onSessionChange, chatCtx, consent, pendingQuotes, resetTurnState]
  );

  const stop = useCallback(() => {
    abortLiveRun(sessionId);
    resetTurnState();
    setLoading(false);
  }, [sessionId, resetTurnState]);

  const confirmGroup = useCallback(
    async (group: { id: string; tools: { toolCallId: string; name: string; args: Record<string, unknown>; argsLabel: string }[] }) => {
      if (confirmBusy) return;
      setConfirmBusy(group.id);
      try {
        const actions = group.tools.map((t) => ({
          name: t.name,
          arguments: t.args,
          toolCallId: t.toolCallId,
        }));
        const res = await api.chat.confirmBatch(actions, sessionId ?? undefined);
        setPendingGroups((prev) => prev.filter((g) => g.id !== group.id));
        if (!res.ok && res.error) {
          throw new Error(res.error);
        }
        // Reporte le résultat réel sur l'appel d'outil bloqué : il est
        // persisté avec la session et rejoué au modèle au tour suivant, sinon
        // l'IA continue de croire que l'action attend une confirmation.
        const results = res.results ?? [];
        const byToolCallId = new Map(
          group.tools.map((t, i) => [t.toolCallId, results[i]])
        );
        const patchResult = (id: string, ok: boolean, result?: string, error?: string) => ({
          result: ok ? (result ?? "OK") : (error ?? "Échec"),
          status: ok ? ("success" as const) : ("error" as const),
        });
        setMessages((prev) =>
          prev.map((m) => {
            const hasTool = m.toolCalls?.some((tc) => byToolCallId.has(tc.id));
            const hasStep = m.steps?.some(
              (s) => s.kind === "tool" && byToolCallId.has(s.id)
            );
            if (!hasTool && !hasStep) return m;
            return {
              ...m,
              toolCalls: m.toolCalls?.map((tc) => {
                const r = byToolCallId.get(tc.id);
                return r ? { ...tc, ...patchResult(tc.id, r.ok, r.result, r.error) } : tc;
              }),
              steps: m.steps?.map((s) => {
                if (s.kind !== "tool") return s;
                const r = byToolCallId.get(s.id);
                return r ? { ...s, ...patchResult(s.id, r.ok, r.result, r.error) } : s;
              }),
            };
          })
        );
        // Une seule toast groupée qui liste ce qui a été fait.
        const lines = results
          .map((r, i) => {
            const label = group.tools[i]?.argsLabel || r.name;
            return r.ok ? `✓ ${label}` : `✗ ${label} : ${r.error ?? "échec"}`;
          })
          .join("\n");
        const okCount = results.filter((r) => r.ok).length;
        const header = `${okCount}/${results.length} action${results.length > 1 ? "s" : ""} exécutée${results.length > 1 ? "s" : ""}`;
        toast.show({
          message: lines ? `${header}\n${lines}` : header,
          tone: okCount === results.length && results.length > 0 ? "success" : "warning",
          duration: 4500,
        });
      } catch (err) {
        toast.show({
          message: err instanceof Error ? err.message : "L'action a échoué",
          tone: "danger",
          duration: 3500,
        });
      } finally {
        setConfirmBusy(null);
      }
    },
    [confirmBusy, toast, sessionId]
  );

  const cancelGroup = useCallback(
    (id: string) => {
      setPendingGroups((prev) => prev.filter((g) => g.id !== id));
      toast.show({ message: "Lot d'actions annulé", tone: "info", duration: 2500 });
    },
    [toast]
  );

  // Remise à l'accueil déclenchée par Ctrl/Cmd+L, appliquée par le hook de
  // raccourcis.
  const resetConversation = useCallback(() => {
    setMessages([welcomeMessage]);
    setPendingQuotes([]);
  }, []);

  const handleKey = useChatShortcuts({
    input,
    setInput,
    send,
    messages,
    loading,
    stop,
    onReset: resetConversation,
  });

  const isWelcome = messages.length <= 1 && messages[0]?.id === "welcome";
  const pendingLabel = FUNNY_THOUGHTS[thinkingIndex % FUNNY_THOUGHTS.length] ?? "";

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      <SelectionCommentLayer
        containerRef={scrollRef}
        onAdd={({ text, comment }) => {
          const id = generateId();
          setPendingQuotes((prev) => [...prev, { id, text, comment }]);
          setHighlightedQuoteId(id);
          if (quoteAnimRef.current) clearTimeout(quoteAnimRef.current);
          quoteAnimRef.current = setTimeout(() => setHighlightedQuoteId(null), 720);
          inputRef.current?.focus();
        }}
      />
      {consent.loaded && !consent.accepted && (
        <div className="shrink-0 pl-14 pr-4 py-3 lg:px-4 bg-[var(--surface-2)] fade-in">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[length:var(--t-small)] font-medium text-[var(--text-1)]">
                Tes messages seront envoyés à une IA
              </p>
              <p className="text-[length:var(--t-small)] text-[var(--text-3)] mt-1 leading-relaxed">
                Ils servent uniquement à te répondre, jamais à entraîner un modèle.
                Tu peux tout exporter ou tout supprimer à tout moment.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href="/privacy"
                className="ui-mono text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors duration-150"
              >
                Vie privée
              </a>
              <button
                onClick={() => void acceptConsent()}
                className="ui-btn ui-btn--primary ui-btn--sm"
              >
                J&apos;accepte
              </button>
            </div>
          </div>
        </div>
      )}
      <ChatTranscript
        scrollRef={scrollRef}
        messages={messages}
        isWelcome={isWelcome}
        loading={loading}
        liveSteps={liveSteps}
        streamingContent={streamingContent}
        streamingActive={streamingActive}
        pendingLabel={pendingLabel}
        error={error}
        onPrompt={(p) => void send(p)}
      />

      <div className="shrink-0 px-4 sm:px-6 pt-1 pb-3">
        <div className="max-w-3xl mx-auto">
          {pendingGroups.length > 0 && (
            <div className="mb-3 space-y-2">
              {pendingGroups.map((g) => (
                <GroupActionCard
                  key={g.id}
                  summary={g.summary}
                  reason={g.reason}
                  tools={g.tools}
                  busy={confirmBusy === g.id}
                  onConfirm={() => void confirmGroup(g)}
                  onCancel={() => cancelGroup(g.id)}
                />
              ))}
            </div>
          )}
          <KeyboardSafe>
            <ChatComposer
              value={input}
              onChange={setInput}
              onSubmit={() => void send(input)}
              onStop={stop}
              loading={loading}
              inputRef={inputRef}
              onKey={handleKey}
              quotes={pendingQuotes}
              highlightedId={highlightedQuoteId}
              onRemoveQuote={(id) =>
                setPendingQuotes((prev) => prev.filter((q) => q.id !== id))
              }
            />
          </KeyboardSafe>
          <p className="hidden sm:block ui-mono text-[var(--text-4)] mt-2.5 text-center">
            Sélectionne un passage de l&apos;IA pour le commenter · Ctrl+Entrée envoie · Shift+Entrée nouvelle ligne · Esc arrêter
          </p>
        </div>
      </div>
    </div>
  );
}

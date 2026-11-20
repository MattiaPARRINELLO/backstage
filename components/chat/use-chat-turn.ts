"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useChatContext } from "@/lib/chat-context";
import type { Message } from "@/components/chat/types";
import {
  FUNNY_THOUGHTS,
  generateId,
} from "@/components/chat/chat-data";
import { getLiveRun } from "@/components/chat/live-run";
import { restoreMessages } from "@/components/chat/use-chat-session";
import type { ChatTurnState } from "@/components/chat/use-chat-turn-state";

interface ChatTurnOptions {
  sessionId: string;
  loading: boolean;
  messagesRef: RefObject<Message[]>;
  hasTitleRef: RefObject<boolean>;
  loadSeqRef: RefObject<number>;
  turnState: ChatTurnState;
  chatCtx: ReturnType<typeof useChatContext>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setSessionTitle: (title: string) => void;
  setLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
}

interface ChatTurn {
  finishAssistant: (content: string) => void;
  reloadFromHistory: () => Promise<void>;
  // Libelle affiche pendant qu'aucune vraie pensee n'alimente le fil.
  pendingLabel: string;
}

// Fin de tour et relecture de l'historique : ce qui ecrit le resultat d'une
// generation dans la conversation. L'application des evenements du flux vit
// dans `use-chat-live-events`.
export function useChatTurn({
  sessionId,
  loading,
  messagesRef,
  hasTitleRef,
  loadSeqRef,
  turnState,
  chatCtx,
  setMessages,
  setSessionTitle,
  setLoading,
  setError,
}: ChatTurnOptions): ChatTurn {
  const [thinkingIndex, setThinkingIndex] = useState(() => Math.floor(Math.random() * FUNNY_THOUGHTS.length));
  const {
    liveSteps,
    finishedToolsRef,
    liveStepsRef,
    turnStartRef,
    activeToolsRef,
    appliedEventsRef,
    resetTurnState,
  } = turnState;

  useEffect(() => {
    // Rotation des pensees humoristiques : uniquement tant qu'aucune vraie
    // pensee ni aucun outil n'alimente le fil.
    if (loading && liveSteps.length === 0) {
      const interval = setInterval(() => {
        setThinkingIndex(Math.floor(Math.random() * FUNNY_THOUGHTS.length));
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [loading, liveSteps.length]);

  // Enregistre la reponse assistant en fin de tour. Idempotent : si la reponse
  // est deja la (historique relu, serveur qui a persiste), on la remplace au
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
    resetTurnState();
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
  }, [finishedToolsRef, liveStepsRef, turnStartRef, setMessages, resetTurnState, setLoading, hasTitleRef, messagesRef, setSessionTitle]);

  // Recharge la conversation depuis l'historique serveur. Utilise quand une
  // generation interrompue (app en arriere-plan) a fini cote serveur : la
  // reponse est persistee, il suffit de la relire.
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
      // Dernier message utilisateur sans reponse : le tour a echoue avant
      // d'etre persiste, on le signale au lieu de laisser croire qu'il tourne.
      const last = restored[restored.length - 1];
      if (last?.role === "user") {
        setError("La réponse a été interrompue. Renvoie ton message.");
      }
    } catch (err) {
      console.warn("[chat] rechargement de l'historique impossible", err);
    }
  }, [sessionId, loadSeqRef, setMessages, resetTurnState, appliedEventsRef, setLoading, activeToolsRef, chatCtx, setError]);

  const pendingLabel = FUNNY_THOUGHTS[thinkingIndex % FUNNY_THOUGHTS.length] ?? "";

  return { finishAssistant, reloadFromHistory, pendingLabel };
}

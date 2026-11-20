"use client";

import { useEffect } from "react";
import { useChatContext } from "@/lib/chat-context";
import { generateId, welcomeMessage } from "@/components/chat/chat-data";
import {
  getLiveRun,
  abortLiveRun,
  resumeLiveRun,
  clearLiveRun,
} from "@/components/chat/live-run";
import {
  restoreMessages,
  type ChatSessionState,
} from "@/components/chat/use-chat-session";
import type { ChatTurnState } from "@/components/chat/use-chat-turn-state";

interface ChatSessionSyncOptions {
  externalSessionId?: string;
  resetSignal: number;
  session: ChatSessionState;
  turnState: ChatTurnState;
  chatCtx: ReturnType<typeof useChatContext>;
  clearGroups: () => void;
  resetQuotes: () => void;
}

// Synchronise la conversation affichee avec les signaux du parent : ouverture
// d'une session existante (reprise d'une generation en cours comprise) et
// remise a zero explicite. Effets de bord uniquement : aucun rendu.
export function useChatSessionSync({
  externalSessionId,
  resetSignal,
  session,
  turnState,
  chatCtx,
  clearGroups,
  resetQuotes,
}: ChatSessionSyncOptions): void {
  const {
    setSessionId,
    setSessionTitle,
    hasTitleRef,
    setMessages,
    setInput,
    setLoading,
    setError,
    prevExternalSessionIdRef,
    prevSessionIdRef,
    loadSeqRef,
  } = session;
  const { resetTurnState, appliedEventsRef, activeToolsRef } = turnState;

  // Demonter la vue (changement de page) n'annule PLUS la generation : elle est
  // portee par `live-run.ts`, hors React, et le serveur la poursuit de toute
  // facon. Seuls Stop / Esc / « nouvelle conversation » l'interrompent.
  useEffect(() => {
    if (externalSessionId && externalSessionId !== prevExternalSessionIdRef.current) {
      prevExternalSessionIdRef.current = externalSessionId;
      // Garde anti-race : si l'utilisateur change rapidement de session, seule
      // la derniere demande de chargement doit appliquer son resultat.
      const seq = ++loadSeqRef.current;
      import("@/app/actions/chat-history").then(({ getChatHistory }) => {
        getChatHistory().then((history) => {
          if (seq !== loadSeqRef.current) return;
          const session = history.sessions.find((s) => s.id === externalSessionId);
          if (session) {
            const restored = restoreMessages(session.messages);
            // Le message utilisateur du tour en cours peut ne pas encore etre
            // dans l'historique (sauvegarde client differee de 2 s, ou onglet
            // ferme juste apres l'envoi) : le gestionnaire de generation le
            // detient, on le reinjecte pour ne pas le perdre a l'ecran.
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
            resetQuotes();
            resetTurnState();
            appliedEventsRef.current = 0;
            setLoading(false);
            setError(null);
            clearGroups();
            activeToolsRef.current = {};
            chatCtx.clearActiveTools();
            // Si une generation tourne encore pour cette conversation, on s'y
            // reattache : le serveur rejoue un instantane puis la suite.
            void resumeLiveRun(session.id);
          }
        });
      });
    }
    // chatCtx est volontairement omis : sa valeur change a chaque outil actif
    // et rechargerait l'historique en ecrasant les messages affiches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSessionId]);

  useEffect(() => {
    if (resetSignal === 0) return;
    const previousSessionId = prevSessionIdRef.current;
    const newId = generateId();
    prevSessionIdRef.current = newId;
    // Reset complet de la conversation declenche par une prop externe (resetSignal) :
    // c'est une synchronisation legitime avec un systeme externe (le parent ChatLayout).
    setSessionTitle("");
    hasTitleRef.current = false;
    setMessages([welcomeMessage]);
    setInput("");
    resetQuotes();
    resetTurnState();
    appliedEventsRef.current = 0;
    setLoading(false);
    setError(null);
    activeToolsRef.current = {};
    chatCtx.clearActiveTools();
    // « Nouvelle conversation » est une action explicite : on arrete le tour
    // en cours de l'ancienne.
    if (previousSessionId) {
      abortLiveRun(previousSessionId);
      clearLiveRun(previousSessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);
}

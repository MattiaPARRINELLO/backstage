"use client";

import { useCallback, useRef } from "react";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useChatContext } from "@/lib/chat-context";
import type { Message } from "@/components/chat/types";
import {
  welcomeMessage,
  generateId,
  generateTitle,
  formatQuotedMessage,
} from "@/components/chat/chat-data";
import { SelectionCommentLayer } from "@/components/chat/SelectionComment";
import { startLiveRun, abortLiveRun } from "@/components/chat/live-run";
import { buildActionContext } from "@/lib/chat-action-context";
import { ChatTranscript } from "@/components/chat/ChatTranscript";
import { ChatConsentBanner } from "@/components/chat/ChatConsentBanner";
import { PendingGroupList } from "@/components/chat/PendingGroupList";
import { useChatAutoscroll } from "@/components/chat/use-chat-autoscroll";
import { useChatShortcuts } from "@/components/chat/use-chat-shortcuts";
import { useSelectionQuotes } from "@/components/chat/use-selection-quotes";
import { useChatConfirmations } from "@/components/chat/use-chat-confirmations";
import { useAiConsent } from "@/components/chat/use-ai-consent";
import { useChatSession } from "@/components/chat/use-chat-session";
import { useChatTurnState } from "@/components/chat/use-chat-turn-state";
import { useChatTurn } from "@/components/chat/use-chat-turn";
import { useChatLiveEvents } from "@/components/chat/use-chat-live-events";
import { useChatSessionSync } from "@/components/chat/use-chat-session-sync";
import { KeyboardSafe } from "@/components/ui/KeyboardSafe";

interface ChatViewProps {
  sessionId?: string;
  resetSignal?: number;
  onSessionChange?: (sessionId: string) => void;
}

export function ChatView({ sessionId: externalSessionId, resetSignal = 0, onSessionChange }: ChatViewProps = {}) {
  const session = useChatSession();
  const {
    messages,
    setMessages,
    messagesRef,
    input,
    setInput,
    loading,
    setLoading,
    error,
    setError,
    sessionId,
    setSessionTitle,
    hasTitleRef,
    loadSeqRef,
    prevExternalSessionIdRef,
  } = session;
  // Extraits commentés (sélection dans une réponse de l'IA) en attente d'envoi.
  const { quotes, highlightedId, addQuote, removeQuote, resetQuotes } = useSelectionQuotes();
  const chatCtx = useChatContext();
  const turnState = useChatTurnState();
  const {
    liveSteps,
    streamingContent,
    streamingActive,
    activeToolsRef,
    turnStartRef,
    resetTurnState,
  } = turnState;

  // Reporte le résultat réel d'un lot confirmé sur les appels d'outil bloqués :
  // il est persisté avec la session et rejoué au modèle au tour suivant, sinon
  // l'IA continue de croire que l'action attend une confirmation.
  const {
    pendingGroups,
    confirmBusy,
    addGroup,
    replaceGroups,
    clearGroups,
    confirmGroup,
    cancelGroup,
  } = useChatConfirmations({ sessionId, setMessages });

  const scrollRef = useRef<HTMLDivElement>(null);
  useChatAutoscroll({ scrollRef, messages, streamingContent });
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Consentement IA : l'état et le cycle vivent dans le hook, la vue garde le
  // bandeau, la garde d'envoi et leurs textes.
  const {
    loaded: consentLoaded,
    accepted: consentAccepted,
    accept: acceptConsent,
  } = useAiConsent();

  const { finishAssistant, reloadFromHistory, pendingLabel } = useChatTurn({
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
  });

  useChatLiveEvents({
    sessionId,
    turnState,
    chatCtx,
    addGroup,
    replaceGroups,
    finishAssistant,
    reloadFromHistory,
    setError,
    setLoading,
  });

  useChatSessionSync({
    externalSessionId,
    resetSignal,
    session,
    turnState,
    chatCtx,
    clearGroups,
    resetQuotes,
  });

  const send = useCallback(
    async (text: string) => {
      // Les extraits commentés sont sérialisés dans le message : le modèle voit
      // la citation et la réaction, l'utilisateur retrouve les modules à
      // l'affichage (voir `parseQuotedMessage`).
      const trimmed = formatQuotedMessage(quotes, text).trim();
      if (!trimmed || loading) return;

      if (consentLoaded && !consentAccepted) {
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
      resetQuotes();
      setError(null);
      activeToolsRef.current = {};
      resetTurnState();
      turnStartRef.current = Date.now();
      chatCtx.clearActiveTools();
      clearGroups();
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
    [loading, messages, sessionId, onSessionChange, chatCtx, consentLoaded, consentAccepted, quotes, resetQuotes, resetTurnState, clearGroups, setMessages, setInput, setError, setSessionTitle, setLoading, hasTitleRef, prevExternalSessionIdRef, activeToolsRef, turnStartRef]
  );

  const stop = useCallback(() => {
    abortLiveRun(sessionId);
    resetTurnState();
    setLoading(false);
  }, [sessionId, resetTurnState, setLoading]);

  // Remise à l'accueil déclenchée par Ctrl/Cmd+L, appliquée par le hook de
  // raccourcis.
  const resetConversation = useCallback(() => {
    setMessages([welcomeMessage]);
    resetQuotes();
  }, [setMessages, resetQuotes]);

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

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      <SelectionCommentLayer
        containerRef={scrollRef}
        onAdd={({ text, comment }) => {
          addQuote({ text, comment });
          inputRef.current?.focus();
        }}
      />
      {consentLoaded && !consentAccepted && (
        <ChatConsentBanner onAccept={() => void acceptConsent()} />
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
            <PendingGroupList
              groups={pendingGroups}
              confirmBusy={confirmBusy}
              onConfirm={(g) => void confirmGroup(g)}
              onCancel={cancelGroup}
            />
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
              quotes={quotes}
              highlightedId={highlightedId}
              onRemoveQuote={removeQuote}
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

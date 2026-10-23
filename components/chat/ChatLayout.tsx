"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatView } from "@/components/chat/ChatView";
import { SessionSidebar } from "@/components/chat/SessionSidebar";
import { ContextPanel } from "@/components/layout/ContextPanel";
import { ChatProvider } from "@/lib/chat-context";
import { MessageSquare } from "lucide-react";

// Conversation active mémorisée pour la session du navigateur : revenir sur
// /chat après une navigation restaure la conversation (et permet de se
// réattacher à une génération en cours) au lieu d'afficher un écran vide.
const ACTIVE_SESSION_KEY = "pb:active-chat-session";

export function ChatLayout() {
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [resetSignal, setResetSignal] = useState(0);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(ACTIVE_SESSION_KEY);
      // Synchronisation légitime avec un système externe (sessionStorage) au
      // montage : le rendu serveur ne peut pas le lire.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setActiveSessionId(saved);
    } catch {
      // sessionStorage indisponible (mode privé strict) : sans conséquence.
    }
  }, []);

  useEffect(() => {
    try {
      if (activeSessionId) sessionStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
      else sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch {
      // idem
    }
  }, [activeSessionId]);

  const handleSelectSession = useCallback(
    (session: {
      id: string;
      title: string;
      messages: {
        id: string;
        role: "user" | "assistant";
        content: string;
        timestamp: string;
        toolCalls?: {
          id: string;
          name: string;
          arguments?: string;
          result?: string;
          status: "running" | "success" | "error";
          duration?: number;
          resultCount?: number;
        }[];
      }[];
    }) => {
      setActiveSessionId(session.id);
      setMobileSessionsOpen(false);
    },
    []
  );

  const handleNewSession = useCallback(() => {
    setActiveSessionId("");
    setResetSignal((k) => k + 1);
    setMobileSessionsOpen(false);
  }, []);

  return (
    <ChatProvider>
      <div className="flex-1 min-w-0 flex h-full">
        <SessionSidebar
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onDeleteSession={(id) => {
            if (id === activeSessionId) {
              setActiveSessionId("");
              setResetSignal((k) => k + 1);
            }
          }}
          mobileOpen={mobileSessionsOpen}
          onMobileClose={() => setMobileSessionsOpen(false)}
        />

        {mobileSessionsOpen && (
          <div
            className="lg:hidden fixed inset-0 z-30 bg-[#000]/50"
            onClick={() => setMobileSessionsOpen(false)}
          />
        )}

        <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 relative">
          <button
            onClick={() => setMobileSessionsOpen(true)}
            className="lg:hidden absolute top-2 left-2 z-10 w-10 h-10 -ml-1.5 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Liste des conversations"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <ChatView
            sessionId={activeSessionId}
            resetSignal={resetSignal}
            onSessionChange={setActiveSessionId}
          />
        </div>
        <ContextPanel />
      </div>
    </ChatProvider>
  );
}

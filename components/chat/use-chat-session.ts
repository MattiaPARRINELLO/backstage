"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ChatSession } from "@/lib/types";
import type { Message, ToolCall } from "@/components/chat/types";
import {
  generateId,
  generateTitle,
  welcomeMessage,
} from "@/components/chat/chat-data";

// Restaure les messages d'une session en normalisant le statut des appels
// d'outil (les sessions anciennes n'en portaient pas).
export function restoreMessages(raw: ChatSession["messages"]): Message[] {
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

export interface ChatSessionState {
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  messagesRef: RefObject<Message[]>;
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  setLoading: (value: boolean) => void;
  error: string | null;
  setError: (value: string | null) => void;
  sessionId: string;
  setSessionId: (value: string) => void;
  sessionTitle: string;
  setSessionTitle: (value: string) => void;
  hasTitleRef: RefObject<boolean>;
  loadSeqRef: RefObject<number>;
  prevExternalSessionIdRef: RefObject<string>;
  prevSessionIdRef: RefObject<string>;
  saveSession: () => void;
}

// Etat de la conversation affichee et persistance : messages, identite de la
// session, saisie, chargement et erreur. Le tour en cours (SSE) et les lots
// d'actions en attente vivent dans leurs propres unites.
export function useChatSession(): ChatSessionState {
  const [messages, setMessages] = useState<Message[]>(() =>
    typeof window !== "undefined"
      ? [welcomeMessage]
      : [welcomeMessage]
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => generateId());
  const [sessionTitle, setSessionTitle] = useState<string>("");

  const messagesRef = useRef<Message[]>(messages);
  const loadSeqRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTitleRef = useRef(false);
  const prevExternalSessionIdRef = useRef<string>("");
  const prevSessionIdRef = useRef(sessionId);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

  useEffect(() => {
    if (!sessionId || messages.length <= 1 || messages[0]?.id === "welcome") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveSession, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, sessionId, saveSession]);

  return {
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
    setSessionId,
    sessionTitle,
    setSessionTitle,
    hasTitleRef,
    loadSeqRef,
    prevExternalSessionIdRef,
    prevSessionIdRef,
    saveSession,
  };
}

"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { Message } from "@/components/chat/types";

// Scroll doux désactivé quand l'utilisateur demande un mouvement réduit.
function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

interface ChatAutoscrollOptions {
  scrollRef: RefObject<HTMLDivElement | null>;
  messages: Message[];
  streamingContent: string;
}

// Politique de défilement du fil : un nouveau message colle en bas, sinon on
// ne suit le contenu qu'à moins de 60 px du bas, pour ne pas arracher la
// lecture à l'utilisateur qui est remonté.
export function useChatAutoscroll({
  scrollRef,
  messages,
  streamingContent,
}: ChatAutoscrollOptions): void {
  const prevMessagesLenRef = useRef(messages.length);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const len = messages.length;
    const isNewMessage = len > prevMessagesLenRef.current;
    prevMessagesLenRef.current = len;
    if (isNewMessage) {
      el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
    } else {
      const threshold = 60;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      if (isNearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
      }
    }
  }, [scrollRef, messages, streamingContent]);
}

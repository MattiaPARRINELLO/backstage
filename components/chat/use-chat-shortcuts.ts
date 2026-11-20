"use client";

import { useEffect } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Message } from "@/components/chat/types";
import { parseQuotedMessage } from "@/components/chat/chat-data";

interface ChatShortcutsOptions {
  input: string;
  setInput: (value: string) => void;
  send: (text: string) => void;
  messages: Message[];
  loading: boolean;
  stop: () => void;
  onReset: () => void;
}

// Raccourcis du composeur : Entrée / Ctrl+Entrée (ou Cmd+Entrée) envoie,
// Entrée seule envoie sur pointeur grossier, flèche haut rappelle le dernier
// message utilisateur, Ctrl/Cmd+L remet la conversation à l'accueil et Échap
// interrompt la génération en cours.
export function useChatShortcuts({
  input,
  setInput,
  send,
  messages,
  loading,
  stop,
  onReset,
}: ChatShortcutsOptions): (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void {
  const handleKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    // Sur écran tactile (pas de clavier physique), Entrée envoie directement ;
    // Shift+Entrée fait une nouvelle ligne. Sur desktop, Ctrl/Cmd+Entrée envoie.
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey || (coarsePointer && !e.shiftKey))) {
      e.preventDefault();
      void send(input);
    } else if (e.key === "ArrowUp" && !input && messages.length > 1) {
      e.preventDefault();
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      // On rappelle le texte libre, pas les extraits déjà consommés.
      if (lastUserMsg) setInput(parseQuotedMessage(lastUserMsg.content).body);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "l") {
        e.preventDefault();
        onReset();
      }
      if (e.key === "Escape" && loading) {
        stop();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loading, stop, onReset]);

  return handleKey;
}

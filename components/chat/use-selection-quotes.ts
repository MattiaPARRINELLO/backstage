"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateId, type MessageQuote } from "@/components/chat/chat-data";

// Durée de la surbrillance qui marque l'arrivée d'un extrait dans le champ.
const HIGHLIGHT_MS = 720;

interface SelectionQuotes {
  quotes: MessageQuote[];
  highlightedId: string | null;
  addQuote: (quote: { text: string; comment: string }) => void;
  removeQuote: (id: string) => void;
  resetQuotes: () => void;
}

// Extraits commentés en attente d'envoi : ajout, retrait, vidage et animation
// d'arrivée. Le focus du champ et la composition du message restent à la vue.
export function useSelectionQuotes(): SelectionQuotes {
  const [quotes, setQuotes] = useState<MessageQuote[]>([]);
  // Dernier extrait ajouté : il « atterrit » avec une animation dans le champ.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Le minuteur d'animation ne doit pas survivre au démontage de la vue.
  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    },
    []
  );

  const addQuote = useCallback(({ text, comment }: { text: string; comment: string }) => {
    const id = generateId();
    setQuotes((prev) => [...prev, { id, text, comment }]);
    setHighlightedId(id);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
  }, []);

  const removeQuote = useCallback((id: string) => {
    setQuotes((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const resetQuotes = useCallback(() => {
    setQuotes([]);
  }, []);

  return { quotes, highlightedId, addQuote, removeQuote, resetQuotes };
}

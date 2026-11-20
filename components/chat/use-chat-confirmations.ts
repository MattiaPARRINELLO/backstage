"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useToast } from "@/components/ui/Toast";
import type { Message } from "@/components/chat/types";
import { confirmedPatch } from "@/components/chat/chat-action-labels";
import {
  usePendingActions,
  type ConfirmResult,
  type PendingGroup,
} from "@/components/chat/use-pending-actions";

interface ChatConfirmationsOptions {
  sessionId: string;
  setMessages: Dispatch<SetStateAction<Message[]>>;
}

// Confirmation des lots d'actions bloques par la politique d'outils : reporte
// le resultat reel sur les messages, affiche le recapitulatif et fournit
// l'annulation. L'etat du lot lui-meme reste dans `use-pending-actions`.
export function useChatConfirmations({
  sessionId,
  setMessages,
}: ChatConfirmationsOptions) {
  const toast = useToast();

  const handleConfirmedResults = useCallback(
    (group: PendingGroup, results: ConfirmResult[]) => {
      const byToolCallId = new Map(
        group.tools.map((t, i) => [t.toolCallId, results[i]])
      );
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
              return r ? { ...tc, ...confirmedPatch(r) } : tc;
            }),
            steps: m.steps?.map((s) => {
              if (s.kind !== "tool") return s;
              const r = byToolCallId.get(s.id);
              return r ? { ...s, ...confirmedPatch(r) } : s;
            }),
          };
        })
      );
      // Une seule toast groupee qui liste ce qui a ete fait.
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
    },
    [toast, setMessages]
  );

  const handleConfirmError = useCallback(
    (_group: PendingGroup, message: string) => {
      toast.show({ message, tone: "danger", duration: 3500 });
    },
    [toast]
  );

  const {
    pendingGroups,
    confirmBusy,
    addGroup,
    replaceGroups,
    removeGroup,
    clearGroups,
    confirmGroup,
  } = usePendingActions({
    sessionId,
    onResults: handleConfirmedResults,
    onError: handleConfirmError,
  });

  const cancelGroup = useCallback(
    (id: string) => {
      removeGroup(id);
      toast.show({ message: "Lot d'actions annulé", tone: "info", duration: 2500 });
    },
    [removeGroup, toast]
  );

  return {
    pendingGroups,
    confirmBusy,
    addGroup,
    replaceGroups,
    clearGroups,
    confirmGroup,
    cancelGroup,
  };
}

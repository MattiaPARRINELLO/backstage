"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api-client";
import type { PendingActionReason } from "@/lib/tool-result";

// Un outil d'un lot en attente de confirmation, déjà résumé pour l'affichage
// (`argsLabel`) et prêt à être envoyé au serveur (`name`, `args`).
export interface PendingTool {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  argsLabel: string;
}

// Lot d'actions produit par le serveur, en attente du choix de l'utilisateur.
export interface PendingGroup {
  id: string;
  summary: string;
  reason: PendingActionReason;
  tools: PendingTool[];
}

type ConfirmBatchResponse = Awaited<ReturnType<typeof api.chat.confirmBatch>>;
export type ConfirmResult = ConfirmBatchResponse["results"][number];

interface PendingActionsOptions {
  sessionId?: string;
  // Résultats d'un lot confirmé et exécuté : la vue y reporte les statuts sur
  // les messages et affiche le récapitulatif.
  onResults: (group: PendingGroup, results: ConfirmResult[]) => void;
  // Échec réseau ou refus serveur : la vue décide comment le signaler.
  onError: (group: PendingGroup, message: string) => void;
}

// État et cycle de confirmation des lots d'actions bloqués par la politique
// d'outils. Le hook ne connaît ni les messages, ni le toast, ni le streaming :
// il expose la liste, l'état d'exécution et les opérations, et délègue le
// résultat par les rappels fournis par la vue.
export function usePendingActions({
  sessionId,
  onResults,
  onError,
}: PendingActionsOptions) {
  const [pendingGroups, setPendingGroups] = useState<PendingGroup[]>([]);
  const [confirmBusy, setConfirmBusy] = useState<string | null>(null);

  const addGroup = useCallback((group: PendingGroup) => {
    setPendingGroups((prev) => [...prev, group]);
  }, []);

  // Remplace la liste entière : utilisé à la reprise d'un run (instantané).
  const replaceGroups = useCallback((groups: PendingGroup[]) => {
    setPendingGroups(groups);
  }, []);

  const removeGroup = useCallback((id: string) => {
    setPendingGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const clearGroups = useCallback(() => {
    setPendingGroups([]);
  }, []);

  const confirmGroup = useCallback(
    async (group: PendingGroup) => {
      if (confirmBusy) return;
      setConfirmBusy(group.id);
      try {
        const actions = group.tools.map((t) => ({
          name: t.name,
          arguments: t.args,
          toolCallId: t.toolCallId,
        }));
        const res = await api.chat.confirmBatch(actions, sessionId ?? undefined);
        // Le lot disparaît dès la réponse, qu'elle réussisse ou non : une
        // seconde confirmation créerait un doublon.
        removeGroup(group.id);
        if (!res.ok && res.error) {
          onError(group, res.error);
          return;
        }
        onResults(group, res.results ?? []);
      } catch (err) {
        onError(group, err instanceof Error ? err.message : "L'action a échoué");
      } finally {
        setConfirmBusy(null);
      }
    },
    [confirmBusy, sessionId, removeGroup, onResults, onError]
  );

  return {
    pendingGroups,
    confirmBusy,
    addGroup,
    replaceGroups,
    removeGroup,
    clearGroups,
    confirmGroup,
  };
}

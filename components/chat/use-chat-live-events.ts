"use client";

import { useCallback, useEffect, useRef } from "react";
import { useChatContext } from "@/lib/chat-context";
import { useToast } from "@/components/ui/Toast";
import type { ActivityStep } from "@/components/chat/types";import { describeAction } from "@/components/chat/chat-action-labels";
import {
  getLiveRun,
  subscribeLiveRun,
  clearLiveRun,
  type LiveRunEvent,
} from "@/components/chat/live-run";
import type { PendingGroup } from "@/components/chat/use-pending-actions";
import type { ChatTurnState } from "@/components/chat/use-chat-turn-state";

interface ChatLiveEventsOptions {
  sessionId: string;
  turnState: ChatTurnState;
  chatCtx: ReturnType<typeof useChatContext>;
  addGroup: (group: PendingGroup) => void;
  replaceGroups: (groups: PendingGroup[]) => void;
  finishAssistant: (content: string) => void;
  reloadFromHistory: () => Promise<void>;
  setError: (value: string | null) => void;
  setLoading: (value: boolean) => void;
}

// Applique un evenement du flux a l'etat affiche et s'abonne au gestionnaire
// de generation : les evenements arrivent meme quand la vue vient d'etre
// remontee (rejeu complet depuis le debut du tour).
export function useChatLiveEvents({
  sessionId,
  turnState,
  chatCtx,
  addGroup,
  replaceGroups,
  finishAssistant,
  reloadFromHistory,
  setError,
  setLoading,
}: ChatLiveEventsOptions): void {
  const toast = useToast();
  const {
    setLiveSteps,
    setStreamingContent,
    setStreamingActive,
    streamingActiveRef,
    bufferRef,
    finishedToolsRef,
    liveStepsRef,
    toolStartsRef,
    activeToolsRef,
    appliedEventsRef,
  } = turnState;

  // Applique un evenement du flux a l'etat affiche. Extrait de `send` pour etre
  // rejoue a l'identique quand on se reattache a une generation en cours.
  const applyEvent = useCallback(
    (event: LiveRunEvent) => {
      if (event.type === "reasoning") {
        // Pensee du modele : on l'ajoute au fil, en continu tant que la
        // derniere etape est une pensee (meme regle que cote serveur).
        const steps = [...liveStepsRef.current];
        const last = steps[steps.length - 1];
        if (last?.kind === "thought") {
          steps[steps.length - 1] = {
            kind: "thought",
            text: (last.text + event.content).slice(0, 4000),
          };
        } else {
          steps.push({ kind: "thought", text: event.content.slice(0, 4000) });
        }
        liveStepsRef.current = steps;
        setLiveSteps(steps);
        return;
      }
      if (event.type === "delta") {
        bufferRef.current += event.content;
        setStreamingContent(bufferRef.current);
        if (!streamingActiveRef.current) {
          streamingActiveRef.current = true;
          setStreamingActive(true);
        }
      } else if (event.type === "tool_start") {
        activeToolsRef.current = {
          ...activeToolsRef.current,
          [event.toolCallId]: {
            id: event.toolCallId,
            name: event.name,
            arguments: event.arguments,
            status: "running",
          },
        };
        toolStartsRef.current[event.toolCallId] = Date.now();
        const steps: ActivityStep[] = [
          ...liveStepsRef.current,
          {
            kind: "tool",
            id: event.toolCallId,
            name: event.name,
            arguments: event.arguments,
            status: "running",
          },
        ];
        liveStepsRef.current = steps;
        setLiveSteps(steps);
        chatCtx.registerToolStart({ id: event.toolCallId, name: event.name, arguments: event.arguments });
      } else if (event.type === "tool_result") {
        const key = Object.keys(activeToolsRef.current).find(
          (k) => activeToolsRef.current[k].name === event.name
        );
        const existing = key ? activeToolsRef.current[key] : null;
        // Duree mesuree par outil, et non cumulee depuis le debut du tour.
        const startedAt = existing ? toolStartsRef.current[existing.id] : undefined;
        const duration = startedAt ? (Date.now() - startedAt) / 1000 : 0;
        const resultCount = event.result
          ? event.result.split("\n").filter(Boolean).length
          : 0;
        // Statut serveur s'il est fourni ; sinon on retombe sur la
        // detection textuelle (messages d'historique plus anciens).
        const isError = event.status
          ? event.status === "error" || event.status === "blocked"
          : event.result.includes("Erreur");
        const status: "success" | "error" = isError ? "error" : "success";
        if (existing) {
          const remaining = { ...activeToolsRef.current };
          delete remaining[key!];
          activeToolsRef.current = remaining;
          delete toolStartsRef.current[existing.id];
          finishedToolsRef.current = [
            ...finishedToolsRef.current,
            {
              ...existing,
              result: event.result,
              status,
              duration,
              resultCount: resultCount || 1,
            },
          ];
          const steps = liveStepsRef.current.map((step) =>
            step.kind === "tool" && step.id === existing.id
              ? { ...step, result: event.result, status, duration, resultCount: resultCount || 1 }
              : step
          );
          liveStepsRef.current = steps;
          setLiveSteps(steps);
        }
        chatCtx.registerToolResult(event.name, event.result, isError, duration);
      } else if (event.type === "group_confirm") {
        addGroup({
          id: event.id,
          summary: event.summary,
          reason: event.reason,
          tools: event.tools.map((t) => {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(t.arguments); } catch { args = {}; }
            return {
              toolCallId: t.toolCallId,
              name: t.name,
              args,
              argsLabel: describeAction(t.name, args),
            };
          }),
        });
      } else if (event.type === "error") {
        setError(event.message);
      } else if (event.type === "memory_facts") {
        const count = event.facts.length;
        if (count > 0) {
          toast.show({
            message: `${count} fait${count > 1 ? "s" : ""} mémorisé${count > 1 ? "s" : ""}`,
            tone: "info",
            duration: 3000,
          });
        }
      } else if (event.type === "snapshot") {
        // Reprise apres navigation / reouverture d'onglet : on reconstruit
        // l'etat affiche a partir de l'instantane serveur.
        bufferRef.current = event.content;
        finishedToolsRef.current = event.tools.map((t) => ({
          ...t,
          status: t.status ?? "success",
        }));
        activeToolsRef.current = Object.fromEntries(
          event.activeTools.map((t) => [t.id, { ...t, status: "running" as const }])
        );
        liveStepsRef.current = event.steps.map((step) =>
          step.kind === "tool"
            ? { ...step, status: step.status ?? "success" }
            : step
        );
        setLiveSteps(liveStepsRef.current);
        toolStartsRef.current = Object.fromEntries(
          event.activeTools.map((t) => [t.id, Date.now()])
        );
        chatCtx.clearActiveTools();
        for (const t of event.activeTools) {
          chatCtx.registerToolStart({
            id: t.id,
            name: t.name,
            arguments: t.arguments ?? "",
          });
        }
        setStreamingContent(event.content);
        streamingActiveRef.current = event.content.length > 0;
        setStreamingActive(event.content.length > 0);
        replaceGroups(
          event.groups.map((g) => ({
            id: g.id,
            summary: g.summary,
            // Instantane d'un run anterieur a la raison : politique par defaut.
            reason: g.reason ?? "policy",
            tools: g.tools.map((t) => {
              let args: Record<string, unknown> = {};
              try { args = JSON.parse(t.arguments); } catch { args = {}; }
              return {
                toolCallId: t.toolCallId,
                name: t.name,
                args,
                argsLabel: describeAction(t.name, args),
              };
            }),
          }))
        );
        if (event.error) setError(event.error);
        if (event.finished) {
          setLoading(false);
          finishAssistant(event.doneContent ?? event.content);
        } else {
          setLoading(true);
        }
      } else if (event.type === "done") {
        finishAssistant(bufferRef.current || event.content || "");
      } else if (event.type === "reload") {
        // La generation a abouti cote serveur : on relit l'historique.
        void reloadFromHistory();
      } else if (event.type === "failed") {
        // Plus de reponse possible : on affiche ce qui a ete recu et on leve
        // l'etat « en train d'ecrire » au lieu de laisser tourner le spinner.
        if (bufferRef.current) finishAssistant(bufferRef.current);
        else {
          setLoading(false);
          streamingActiveRef.current = false;
          setStreamingActive(false);
          setStreamingContent("");
        }
        setError(event.message);
      }
    },
    [chatCtx, toast, finishAssistant, reloadFromHistory, addGroup, replaceGroups, setError, setLoading, setLiveSteps, setStreamingContent, setStreamingActive, streamingActiveRef, bufferRef, finishedToolsRef, liveStepsRef, toolStartsRef, activeToolsRef]
  );

  // `applyEvent` passe par une ref : sa valeur change a chaque outil actif, et
  // re-souscrire a ce moment-la rejouerait tout le tampon (texte duplique).
  const applyEventRef = useRef(applyEvent);
  useEffect(() => {
    applyEventRef.current = applyEvent;
  }, [applyEvent]);

  useEffect(() => {
    if (!sessionId) return;
    appliedEventsRef.current = 0;
    const apply = () => {
      const run = getLiveRun(sessionId);
      if (!run) return;
      if (appliedEventsRef.current > run.events.length) appliedEventsRef.current = 0;
      while (appliedEventsRef.current < run.events.length) {
        applyEventRef.current(run.events[appliedEventsRef.current]);
        appliedEventsRef.current += 1;
      }
      if (run.status !== "running" && appliedEventsRef.current >= run.events.length) {
        clearLiveRun(sessionId);
      }
    };
    const unsubscribe = subscribeLiveRun(sessionId, apply);
    apply();
    return unsubscribe;
  }, [sessionId, appliedEventsRef]);
}

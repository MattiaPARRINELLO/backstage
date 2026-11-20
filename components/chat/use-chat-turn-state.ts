"use client";

import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ActivityStep, ToolCall } from "@/components/chat/types";

export interface ChatTurnState {
  liveSteps: ActivityStep[];
  setLiveSteps: (steps: ActivityStep[]) => void;
  streamingContent: string;
  setStreamingContent: (content: string) => void;
  streamingActive: boolean;
  setStreamingActive: (active: boolean) => void;
  streamingActiveRef: RefObject<boolean>;
  bufferRef: RefObject<string>;
  finishedToolsRef: RefObject<ToolCall[]>;
  liveStepsRef: RefObject<ActivityStep[]>;
  toolStartsRef: RefObject<Record<string, number>>;
  activeToolsRef: RefObject<Record<string, ToolCall>>;
  appliedEventsRef: RefObject<number>;
  turnStartRef: RefObject<number>;
  // Remet a zero l'etat du tour en cours (texte, outils, fil d'activite).
  resetTurnState: () => void;
}

// Etat mutable du tour en cours. Les refs portent ce qui doit survivre aux
// re-rendus et etre rejoue tel quel quand on se reattache a une generation ;
// l'etat React porte ce qui s'affiche.
export function useChatTurnState(): ChatTurnState {
  const [liveSteps, setLiveSteps] = useState<ActivityStep[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingActive, setStreamingActive] = useState(false);
  const streamingActiveRef = useRef(false);
  const bufferRef = useRef("");
  const finishedToolsRef = useRef<ToolCall[]>([]);
  const liveStepsRef = useRef<ActivityStep[]>([]);
  const toolStartsRef = useRef<Record<string, number>>({});
  const activeToolsRef = useRef<Record<string, ToolCall>>({});
  const appliedEventsRef = useRef(0);
  const turnStartRef = useRef(0);

  const resetTurnState = useCallback(() => {
    bufferRef.current = "";
    finishedToolsRef.current = [];
    liveStepsRef.current = [];
    toolStartsRef.current = {};
    activeToolsRef.current = {};
    setLiveSteps([]);
    setStreamingContent("");
    streamingActiveRef.current = false;
    setStreamingActive(false);
  }, []);

  return {
    liveSteps,
    setLiveSteps,
    streamingContent,
    setStreamingContent,
    streamingActive,
    setStreamingActive,
    streamingActiveRef,
    bufferRef,
    finishedToolsRef,
    liveStepsRef,
    toolStartsRef,
    activeToolsRef,
    appliedEventsRef,
    turnStartRef,
    resetTurnState,
  };
}

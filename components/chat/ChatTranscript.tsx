"use client";

import type { RefObject } from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/Markdown";
import { HomeHero } from "@/components/chat/HomeHero";
import {
  MessageBlock,
  ActivityTrail,
  AssistantAvatar,
} from "@/components/chat/MessageBlocks";
import type { ActivityStep, Message } from "@/components/chat/types";

interface ChatTranscriptProps {
  // Le conteneur de défilement reste possédé par `ChatView` : l'autoscroll et
  // les commentaires de sélection s'y accrochent.
  scrollRef: RefObject<HTMLDivElement | null>;
  messages: Message[];
  isWelcome: boolean;
  loading: boolean;
  liveSteps: ActivityStep[];
  streamingContent: string;
  streamingActive: boolean;
  pendingLabel: string;
  error: string | null;
  onPrompt: (prompt: string) => void;
}

// Rendu du fil de conversation : accueil, messages, tour en cours et erreur.
// Aucun état n'est porté ici : changer le design du fil ne doit pas toucher au
// cycle de la conversation.
export function ChatTranscript({
  scrollRef,
  messages,
  isWelcome,
  loading,
  liveSteps,
  streamingContent,
  streamingActive,
  pendingLabel,
  error,
  onPrompt,
}: ChatTranscriptProps) {
  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div
        className={cn(
          "max-w-3xl mx-auto px-4 sm:px-6",
          // L'accueil est ancré en haut : son badge est suspendu au bord
          // supérieur de la zone de défilement, donc le padding haut est
          // annulé et la coupe du tour de cou est posée par HomeHero.
          isWelcome
            ? "min-h-full flex flex-col pb-6"
            : "py-8 sm:py-12"
        )}
      >
        {isWelcome ? (
          <HomeHero onPrompt={onPrompt} disabled={loading} />
        ) : (
          <div className="space-y-6 chat-stagger">
            {messages.map((m) => {
              return (
                <div key={m.id}>
                  <MessageBlock message={m} />
                </div>
              );
            })}
            {loading && (
              <div key="live" className="flex gap-3 fade-in-up">
                <AssistantAvatar />
                <div className="min-w-0 flex-1 pt-0.5">
                  <ActivityTrail
                    steps={liveSteps}
                    running
                    pendingLabel={pendingLabel}
                  />
                  {streamingActive && streamingContent && (
                    <div className="text-[length:var(--t-body)] leading-[1.75] text-[var(--text-1)]">
                      <Markdown>{streamingContent}</Markdown>
                      <span className="blink-cursor">█</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-6 flex items-start gap-2.5 text-[length:var(--t-small)] text-[var(--danger)] px-3 py-2.5 rounded-[var(--r-sm)] bg-[var(--danger)]/5 fade-in">
            <span className="w-1 h-1 rounded-full bg-[var(--danger)] mt-1.5 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, memo } from "react";
import Image from "next/image";
import {
  Check,
  Copy,
  Mail,
  CalendarPlus,
  Bell,
  Sparkles,
  Quote,
  CornerDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/Markdown";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { ActivityStep, Message } from "@/components/chat/types";
import type { PendingActionReason } from "@/lib/tool-result";
import { toolMeta, parseQuotedMessage } from "@/components/chat/chat-data";
import { normalizeToolName } from "@/lib/chat-tool-aliases";
import { ActivityTrail } from "@/components/chat/ActivityTrail";

export function AssistantAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-full bg-[var(--surface-2)] flex items-center justify-center overflow-hidden",
        size === "md" ? "w-7 h-7" : "w-6 h-6"
      )}
    >
      <Image
        src="/backstage-logo-simple.png"
        alt="BACKSTAGE"
        width={18}
        height={18}
        className={size === "md" ? "w-4 h-4 object-contain" : "w-3.5 h-3.5 object-contain"}
      />
    </div>
  );
}

function containsEmailContent(text: string) {
  return /@\w+\.\w+/.test(text) || /\b(email|mail|e-?mail|courriel|envoyer|écrire)\b/i.test(text);
}

function containsCalendarContent(text: string) {
  return /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/.test(text)
    || /\b(calend(?:er|ar|rier|rier)|agenda|rendez-?vous|meeting|réunion|event|rdv|séance|séminaire)\b/i.test(text)
    || /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i.test(text);
}

function containsReminderContent(text: string) {
  return /\b(rappel?|remind|todo|à faire|tâche|task|noter|mémoriser|pense à|n'oublie)\b/i.test(text);
}

function ActionChips({ message }: { message: Message }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const toast = useToast();
  const isAssistant = message.role === "assistant" && message.id !== "welcome";
  if (!isAssistant || !message.content) return null;

  const content = message.content;
  const showMail = containsEmailContent(content);
  const showCalendar = containsCalendarContent(content);
  const showReminder = containsReminderContent(content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleAddReminder = async () => {
    try {
      const { createReminder } = await import("@/app/actions/reminders");
      await createReminder({
        title: content.slice(0, 120),
        notes: content.slice(0, 2000),
        dueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      toast.show({ message: "Rappel créé", tone: "success", duration: 2500 });
    } catch {
      toast.show({ message: "Impossible de créer le rappel", tone: "danger", duration: 3000 });
    }
  };

  const handleAddCalendar = async () => {
    try {
      const start = new Date(Date.now() + 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const res = await api.calendar.create({
        summary: content.slice(0, 80),
        start: start.toISOString(),
        end: end.toISOString(),
      });
      if (!res.success) throw new Error("Échec de l'ajout");
      toast.show({ message: "Événement ajouté au calendrier", tone: "success", duration: 2500 });
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : "Impossible d'ajouter au calendrier",
        tone: "danger",
        duration: 3000,
      });
    }
  };

  const btn =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[length:var(--t-small)] text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors duration-150";

  return (
    <div className="mt-3 flex flex-wrap gap-1 fade-in-action-chips">
      <button onClick={handleCopy} className={btn}>
        {copiedId === message.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copiedId === message.id ? "Copié" : "Copier"}
      </button>
      {showMail && (
        <a href={`mailto:?body=${encodeURIComponent(content)}`} className={btn}>
          <Mail className="w-3.5 h-3.5" />
          Voir le mail
        </a>
      )}
      {showCalendar && (
        <button onClick={() => void handleAddCalendar()} className={btn}>
          <CalendarPlus className="w-3.5 h-3.5" />
          Ajouter au calendrier
        </button>
      )}
      {showReminder && (
        <button onClick={() => void handleAddReminder()} className={btn}>
          <Bell className="w-3.5 h-3.5" />
          Créer un rappel
        </button>
      )}
    </div>
  );
}

// Compatibilité avec les tours enregistrés avant le fil d'activité : on
// reconstruit des étapes à partir des seuls appels d'outil.
function stepsOf(message: Message): ActivityStep[] {
  if (message.steps?.length) return message.steps;
  return (message.toolCalls ?? []).map((tc) => ({ kind: "tool", ...tc }));
}

// Memoïsé : la saisie (setInput) re-rend ChatView à chaque frappe, mais les
// messages existants sont des références stables — on évite de re-parser tout
// le markdown de la conversation à chaque keypress.
// Message utilisateur : les extraits commentés forment des modules au-dessus
// du texte libre, plutôt qu'un bloc de Markdown brut.
function UserMessage({ content }: { content: string }) {
  const { quotes, body } = parseQuotedMessage(content);

  if (quotes.length === 0) {
    return (
      <div className="max-w-[85%] sm:max-w-[75%] rounded-[var(--r-tile)] bg-[var(--surface-2)] px-4 py-2.5 text-[length:var(--t-body)] leading-[1.6] text-[var(--text-1)] whitespace-pre-wrap break-words">
        {content}
      </div>
    );
  }

  return (
    <div className="max-w-[85%] sm:max-w-[75%] space-y-2">
      {quotes.map((quote, index) => (
        <div
          key={index}
          className="relative overflow-hidden rounded-[var(--r-tile)] border border-[var(--line)] bg-[var(--surface-1)] pl-4 pr-3.5 py-3"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[2px]"
            style={{
              background: "linear-gradient(to bottom, var(--accent), transparent)",
            }}
          />
          <p className="flex items-center gap-1.5 ui-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-4)]">
            <Quote className="w-2.5 h-2.5 text-[var(--accent)]" strokeWidth={2.5} />
            Extrait
          </p>
          <p className="mt-1 text-[length:var(--t-small)] leading-[1.6] text-[var(--text-2)] whitespace-pre-wrap break-words">
            {quote.text}
          </p>
          {quote.comment && (
            <p className="mt-2 flex items-start gap-1.5 text-[length:var(--t-body)] leading-[1.6] text-[var(--text-1)]">
              <CornerDownRight
                className="w-3.5 h-3.5 mt-[5px] shrink-0 text-[var(--text-4)]"
                strokeWidth={2}
              />
              <span className="min-w-0 whitespace-pre-wrap break-words">{quote.comment}</span>
            </p>
          )}
        </div>
      ))}
      {body && (
        <div className="rounded-[var(--r-tile)] bg-[var(--surface-2)] px-4 py-2.5 text-[length:var(--t-body)] leading-[1.6] text-[var(--text-1)] whitespace-pre-wrap break-words">
          {body}
        </div>
      )}
    </div>
  );
}

export const MessageBlock = memo(function MessageBlock({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <UserMessage content={message.content} />
      </div>
    );
  }

  const steps = stepsOf(message);

  return (
    <div className="flex gap-3" data-chat-role="assistant">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 pt-0.5">
        {steps.length > 0 && (
          <ActivityTrail steps={steps} activityMs={message.activityMs} />
        )}
        <div className="text-[length:var(--t-body)] leading-[1.75] text-[var(--text-1)]">
          <Markdown>{message.content}</Markdown>
        </div>
        <ActionChips message={message} />
      </div>
    </div>
  );
});

// Carte de confirmation GROUPÉE : un lot d'actions à effet externe est soumis
// à l'utilisateur en une seule carte, avec un résumé rédigé par l'IA et la
// liste des actions. « Confirmer tout » exécute le lot entier.
export function GroupActionCard({
  summary,
  reason,
  tools,
  onConfirm,
  onCancel,
  busy,
}: {
  summary: string;
  reason: PendingActionReason;
  tools: { name: string; argsLabel: string }[];
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const reasonLabel =
    reason === "provenance"
      ? "Proposé après lecture d'un contenu externe (email, page, recherche) : à valider."
      : "Action sensible : elle ne part pas sans ton accord.";
  return (
    <div className="ui-tile px-4 py-3.5 text-[length:var(--t-small)] fade-in-up">
      <div className="flex items-center gap-2 text-[var(--text-1)]">
        {tools[0] ? (() => {
          const meta = toolMeta[normalizeToolName(tools[0].name)];
          const Icon = meta?.icon ?? Sparkles;
          return <Icon className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" />;
        })() : null}
        <span className="font-display font-semibold tracking-[-0.03em] text-[length:var(--t-body)]">Actions à confirmer</span>
        <span className="ui-mono text-[var(--text-3)]">
          {tools.length > 1 ? `${tools.length} actions` : "1 action"}
        </span>
      </div>
      <p className="mt-1 ui-mono text-[var(--text-3)]">{reasonLabel}</p>
      {summary && (
        <p className="mt-2 text-[var(--text-2)] leading-relaxed">
          {summary}
        </p>
      )}
      <ul className="mt-2.5 divide-y divide-[var(--line)]">
        {tools.map((t) => (
          <li key={t.name + t.argsLabel} className="py-1.5 leading-snug whitespace-pre-wrap break-words text-[var(--text-3)]">
            {t.argsLabel || t.name}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onConfirm}
          disabled={busy}
          className="ui-btn ui-btn--primary ui-btn--sm disabled:opacity-50"
        >
          {busy ? "Exécution…" : tools.length > 1 ? "Confirmer tout" : "Confirmer"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="ui-btn ui-btn--ghost ui-btn--sm disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, memo } from "react";
import Image from "next/image";
import {
  Check,
  Copy,
  Mail,
  CalendarPlus,
  Bell,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/Markdown";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { Message, ToolCall } from "@/components/chat/types";
import { toolMeta, FUNNY_THOUGHTS } from "@/components/chat/chat-data";

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

// Memoïsé : la saisie (setInput) re-rend ChatView à chaque frappe, mais les
// messages existants sont des références stables — on évite de re-parser tout
// le markdown de la conversation à chaque keypress.
export const MessageBlock = memo(function MessageBlock({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-[var(--r-tile)] bg-[var(--surface-2)] px-4 py-2.5 text-[length:var(--t-body)] leading-[1.6] text-[var(--text-1)] whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-[length:var(--t-body)] leading-[1.75] text-[var(--text-1)]">
          <Markdown>{message.content}</Markdown>
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 space-y-1.5 fade-in-up">
            {message.toolCalls.map((tc) => (
              <ToolCallResult key={tc.id} tool={tc} />
            ))}
          </div>
        )}
        <ActionChips message={message} />
      </div>
    </div>
  );
});

function ToolCallResult({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const isError = tool.status === "error";
  const isRunning = tool.status === "running";
  const Icon = toolMeta[tool.name]?.icon ?? Sparkles;
  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-col items-stretch rounded-[var(--r-sm)] border px-3 py-2 ui-mono",
        isRunning
          ? "border-[var(--accent)]/30 bg-[var(--accent)]/5 text-[var(--accent)]"
          : isError
            ? "border-[var(--danger)]/30 bg-[var(--danger)]/5 text-[var(--danger)]"
            : "border-[var(--line)] bg-[var(--surface-1)] text-[var(--text-2)]"
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 min-w-0 text-left"
      >
        {isRunning ? (
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse shrink-0" />
        ) : (
          <Icon
            className={cn(
              "w-3 h-3 shrink-0",
              isError ? "text-[var(--danger)]" : "text-[var(--success)]"
            )}
          />
        )}
        <span className="truncate">{toolMeta[tool.name]?.label || tool.name}</span>
        {!isRunning && isError && (
          <span className="shrink-0 text-[var(--danger)]">· échec</span>
        )}
        {tool.duration != null && !isRunning && (
          <span className="text-[var(--text-4)]">· {tool.duration.toFixed(1)}s</span>
        )}
        {tool.resultCount != null && !isRunning && (
          <span className="text-[var(--text-4)]">· {tool.resultCount} résultats</span>
        )}
        {expanded ? <ChevronUp className="w-3 h-3 shrink-0 text-[var(--text-4)]" /> : <ChevronDown className="w-3 h-3 shrink-0 text-[var(--text-4)]" />}
      </button>
      {expanded && (
        <div
          className={cn(
            "mt-2 pt-2 border-t border-[var(--line)] whitespace-pre-wrap break-all text-[var(--text-3)]",
            isError && "text-[var(--danger)]"
          )}
        >
          {isRunning && tool.arguments ? tool.arguments : tool.result || tool.arguments || ""}
        </div>
      )}
    </div>
  );
}

export function ToolCallTray({ tools }: { tools: ToolCall[] }) {
  return (
    <div className="flex gap-2 flex-wrap py-0.5">
      {tools.map((t) => (
        <ToolCallResult key={t.id} tool={t} />
      ))}
    </div>
  );
}

// Carte de confirmation GROUPÉE : un lot d'actions à effet externe est soumis
// à l'utilisateur en une seule carte, avec un résumé rédigé par l'IA et la
// liste des actions. « Confirmer tout » exécute le lot entier.
export function GroupActionCard({
  summary,
  tools,
  onConfirm,
  onCancel,
  busy,
}: {
  summary: string;
  tools: { name: string; argsLabel: string }[];
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className="ui-tile px-4 py-3.5 text-[length:var(--t-small)] fade-in-up">
      <div className="flex items-center gap-2 text-[var(--text-1)]">
        {tools[0] ? (() => {
          const meta = toolMeta[tools[0].name];
          const Icon = meta?.icon ?? Sparkles;
          return <Icon className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" />;
        })() : null}
        <span className="font-display font-semibold tracking-[-0.03em] text-[length:var(--t-body)]">Actions à confirmer</span>
        <span className="ui-mono text-[var(--text-3)]">
          {tools.length > 1 ? `${tools.length} actions` : "1 action"}
        </span>
      </div>
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

export function ThinkingIndicator({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] thinking-dot" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] thinking-dot" style={{ animationDelay: "0.15s" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] thinking-dot" style={{ animationDelay: "0.3s" }} />
      </div>
      <span className="ui-mono text-[var(--text-3)]">
        {FUNNY_THOUGHTS[index % FUNNY_THOUGHTS.length]}
      </span>
    </div>
  );
}

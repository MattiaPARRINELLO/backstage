"use client";

import { useRef, useState } from "react";
import { Send, Square, Plus, AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceInput } from "@/components/chat/VoiceInput";

export interface ChatComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  loading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onKey: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  loading: isLoading,
  inputRef: ref,
  onKey,
}: ChatComposerProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [voiceLive, setVoiceLive] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);

  // Texte affiché : saisie + dictée vocale en cours (résultats intermédiaires).
  const displayValue = voiceLive ? (value ? value + " " : "") + voiceLive : value;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onChange(value + ` [Fichier: ${files[0].name}]`);
    }
  };

  const insertMention = (mention: string) => {
    onChange(value + mention + " ");
    setShowMentionMenu(false);
    ref.current?.focus();
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    onChange(v);
    setVoiceLive("");
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
    // Sur mobile (bouton @ masqué), taper "@" ouvre le menu de mention.
    setShowMentionMenu(/@[a-z]*$/i.test(v) && !v.endsWith(" "));
  };

  const iconButton =
    "shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)] transition-colors duration-150";

  return (
    <div className="relative">
      {showMentionMenu && (
        <div className="absolute bottom-full left-2 mb-2 w-60 rounded-[var(--r-tile)] border border-[var(--line)] bg-[var(--surface-1)] shadow-[var(--shadow-float)] p-1 z-50">
          <p className="px-2.5 pt-1.5 pb-1 ui-mono text-[var(--text-4)]">
            Mentionner un module
          </p>
          {[
            { label: "@gmail", desc: "Rechercher dans les mails" },
            { label: "@calendar", desc: "Consulter le calendrier" },
            { label: "@memory", desc: "Interroger la mémoire" },
          ].map((m) => (
            <button
              key={m.label}
              onClick={() => insertMention(m.label)}
              className="w-full text-left px-3 py-2 rounded-[var(--r-sm)] hover:bg-[var(--surface-2)] transition-colors duration-150"
            >
              <span className="text-[length:var(--t-small)] text-[var(--accent)] ui-mono">{m.label}</span>
              <span className="block text-[length:var(--t-small)] text-[var(--text-3)]">{m.desc}</span>
            </button>
          ))}
        </div>
      )}
      <div
        className={cn(
          "ui-field items-end! h-auto! min-h-11 gap-0 px-2! py-1.5",
          dragOver && "border-[var(--accent)]!"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="hidden sm:block">
          <button
            onClick={() => setShowMentionMenu(!showMentionMenu)}
            className={cn(
              iconButton,
              showMentionMenu && "bg-[var(--accent)]/10 text-[var(--accent)]"
            )}
            title="Mentionner un module (@gmail, @calendar, @memory)"
            aria-label="Mentionner un module"
          >
            <AtSign className="w-[18px] h-[18px]" strokeWidth={1.6} />
          </button>
        </div>

        <VoiceInput
          onResult={(text) => {
            onChange(value + (voiceLive ? " " : "") + text);
            setVoiceLive("");
          }}
          onInterim={setVoiceLive}
          onListeningChange={setVoiceActive}
          disabled={isLoading}
        />
        <button
          onClick={handleFileUpload}
          className={iconButton}
          title="Uploader un fichier"
          aria-label="Uploader un fichier"
        >
          <Plus className="w-[18px] h-[18px]" strokeWidth={1.6} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange(value + ` [Fichier: ${file.name}]`);
            e.target.value = "";
          }}
        />

        <textarea
          ref={ref}
          value={displayValue}
          enterKeyHint="send"
          autoCapitalize="sentences"
          autoCorrect="on"
          onChange={handleChange}
          onKeyDown={onKey}
          placeholder={voiceActive ? "Parle maintenant…" : "Écris un message…"}
          rows={1}
          className="flex-1 bg-transparent text-[length:var(--t-body)] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none resize-none font-sans px-2 py-2.5 max-h-[200px]"
        />
        {isLoading ? (
          <button
            onClick={onStop}
            className="ui-btn ui-btn--ghost shrink-0 w-10 h-10! px-0! text-[var(--danger)]!"
            title="Arrêter"
            aria-label="Arrêter"
          >
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={!displayValue.trim()}
            className="ui-btn ui-btn--primary shrink-0 w-10 h-10! px-0!"
            title="Envoyer"
            aria-label="Envoyer"
          >
            <Send className="w-4 h-4" strokeWidth={2} />
          </button>
        )}
      </div>
      {dragOver && (
        <div className="absolute inset-0 rounded-[var(--r-card)] flex items-center justify-center bg-[var(--surface-1)]/95 border border-[var(--accent)] z-10">
          <span className="ui-mono text-[var(--accent)]">
            Déposer le fichier
          </span>
        </div>
      )}
    </div>
  );
}

"use client";

// ============================================================
// Etat de la palette de commandes : ouverture, saisie, filtrage,
// navigation clavier et execution.
// ============================================================

import { useState, useEffect, useRef, useCallback, useTransition, useMemo } from "react";
import { COMMANDS } from "./commands";
import type { ResultItem } from "./types";

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* ----- keyboard shortcut : Cmd+K / Ctrl+K ----- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            setInput("");
            setFeedback(null);
            setSelectedIdx(0);
          }
          return !prev;
        });
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        setInput("");
        setFeedback(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  /* ----- ouverture depuis un bouton (mobile) ----- */
  useEffect(() => {
    const openPalette = () => {
      setInput("");
      setFeedback(null);
      setSelectedIdx(0);
      setOpen(true);
    };
    window.addEventListener("backstage:open-palette", openPalette);
    return () => window.removeEventListener("backstage:open-palette", openPalette);
  }, []);

  /* ----- auto-focus on open ----- */
  useEffect(() => {
    if (open) {
      // Small delay to let React paint the overlay first
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open]);

  /* ----- filter suggestions -------------------------------------------------- */
  const suggestions = useMemo(() => {
    if (!open) return [];
    const q = input.toLowerCase();
    return COMMANDS.filter((cmd) => {
      const searchable = `${cmd.prefix} ${cmd.label} ${cmd.description}`.toLowerCase();
      return searchable.includes(q);
    });
  }, [input, open]);

  /* ----- active command detection -------------------------------------------- */
  const activeCommand = useMemo(() => {
    if (!input.startsWith("/")) return null;

    for (const cmd of COMMANDS) {
      if (input.startsWith(cmd.prefix)) {
        const args = cmd.parse(input);
        return args !== null ? { command: cmd, args } : { command: cmd, args: null };
      }
    }

    // Partial prefix match (user typed "/co" for example)
    const partial = COMMANDS.find((cmd) => cmd.prefix.startsWith(input));
    if (partial) return { command: partial, args: null };

    return null;
  }, [input]);

  /* ----- unified results list ------------------------------------------------ */
  const results = useMemo((): ResultItem[] => {
    // 1. If a command is fully parsed, show its execute action
    if (activeCommand && activeCommand.args !== null) {
      const cmd = activeCommand.command;
      return [
        {
          id: `exec-${cmd.id}`,
          label: cmd.label,
          description: cmd.usage,
          icon: cmd.icon,
          badge: "⏎ Enter",
          kind: "execute",
        },
      ];
    }

    // 2. If input matches a command prefix but args are incomplete, show that command
    if (activeCommand && activeCommand.args === null) {
      const cmd = activeCommand.command;
      return [
        {
          id: `partial-${cmd.id}`,
          label: cmd.label,
          description: cmd.description,
          icon: cmd.icon,
          badge: cmd.prefix,
          kind: "command",
        },
      ];
    }

    // 3. Input doesn't start with "/", show filtered suggestions
    const source = input.trim() ? suggestions : COMMANDS;
    return source.map((cmd) => ({
      id: cmd.id,
      label: cmd.label,
      description: cmd.description,
      icon: cmd.icon,
      badge: cmd.prefix,
      kind: "command" as const,
    }));
  }, [activeCommand, suggestions, input]);

  /* ----- guard selected index ------------------------------------------------ */
  const safeIdx = Math.min(selectedIdx, Math.max(results.length - 1, 0));

  /* ----- execute ------------------------------------------------------------- */
  const executeSelected = useCallback(() => {
    // Garde anti double-execution (double Entree rapide, doublon cote serveur)
    if (busy) return;

    // If a command is fully parsed, execute it
    if (activeCommand && activeCommand.args !== null) {
      setBusy(true);
      startTransition(async () => {
        try {
          const msg = await activeCommand.command.execute(activeCommand.args);
          setFeedback({ kind: "success", message: msg });
          setTimeout(() => {
            setOpen(false);
            setInput("");
            setFeedback(null);
            setBusy(false);
          }, 1200);
        } catch (err) {
          setFeedback({
            kind: "error",
            message: err instanceof Error ? err.message : "Erreur inconnue",
          });
          setBusy(false);
        }
      });
      return;
    }

    // Otherwise, fill the input with the selected command's prefix
    const item = results[safeIdx];
    if (item) {
      setInput(item.badge + " ");
      inputRef.current?.focus();
    }
  }, [busy, activeCommand, results, safeIdx, startTransition]);

  /* ----- keyboard navigation ------------------------------------------------ */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeSelected();
    }
  };

  const close = useCallback(() => {
    setOpen(false);
    setInput("");
    setFeedback(null);
  }, []);

  const pickPrefix = useCallback((prefix: string) => {
    setInput(prefix + " ");
    inputRef.current?.focus();
  }, []);

  return {
    open,
    input,
    setInput,
    selectedIdx,
    setSelectedIdx,
    busy,
    feedback,
    inputRef,
    listRef,
    results,
    safeIdx,
    executeSelected,
    handleKeyDown,
    close,
    pickPrefix,
  };
}

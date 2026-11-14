"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquarePlus, Quote, X } from "lucide-react";

interface Anchor {
  top: number;
  left: number;
}

interface PendingSelection {
  text: string;
  anchor: Anchor;
  above: boolean;
}

export interface SelectionCommentLayerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (quote: { text: string; comment: string }) => void;
  enabled?: boolean;
}

// Sélection de texte dans une réponse de l'IA → micro pop-up pour commenter
// l'extrait. Le commentaire est ensuite joint au prochain message envoyé.
export function SelectionCommentLayer({
  containerRef,
  onAdd,
  enabled = true,
}: SelectionCommentLayerProps) {
  const [selection, setSelection] = useState<PendingSelection | null>(null);
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState("");
  const [closing, setClosing] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setSelection(null);
    setCommenting(false);
    setComment("");
    setClosing(false);
  }, []);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const readSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const text = sel.toString().replace(/\s+/g, " ").trim();
      if (text.length < 2) return;

      // Uniquement une sélection à l'intérieur d'une réponse de l'IA.
      const startNode =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? (range.startContainer as Element)
          : range.startContainer.parentElement;
      const endNode =
        range.endContainer.nodeType === Node.ELEMENT_NODE
          ? (range.endContainer as Element)
          : range.endContainer.parentElement;
      const startMessage = startNode?.closest('[data-chat-role="assistant"]');
      const endMessage = endNode?.closest('[data-chat-role="assistant"]');
      if (!startMessage || !endMessage || startMessage !== endMessage) return;
      if (!container.contains(startMessage)) return;
      if (popRef.current?.contains(startMessage)) return;
      if (popRef.current?.contains(range.commonAncestorContainer)) return;

      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) return;
      const above = rect.top > 120;
      const half = 160;
      const left = Math.min(
        Math.max(rect.left + rect.width / 2, half),
        window.innerWidth - half
      );
      setSelection({
        text,
        anchor: { top: above ? rect.top - 10 : rect.bottom + 10, left },
        above,
      });
      setCommenting(false);
      setComment("");
      setClosing(false);
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRead = () => {
      if (timer) clearTimeout(timer);
      // Laisse le navigateur stabiliser la sélection (souris et tactile).
      timer = setTimeout(readSelection, 0);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      scheduleRead();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.shiftKey || e.key === "Shift") scheduleRead();
    };
    const onScroll = () => close();

    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keyup", onKeyUp);
    container.addEventListener("scroll", onScroll, true);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keyup", onKeyUp);
      container.removeEventListener("scroll", onScroll, true);
    };
  }, [containerRef, enabled, close]);

  useEffect(() => {
    if (commenting) areaRef.current?.focus();
  }, [commenting]);

  if (!selection) return null;

  return (
    <div
      ref={popRef}
      className="fixed z-50"
      style={{
        top: selection.anchor.top,
        left: selection.anchor.left,
        transform: `translate(-50%, ${selection.above ? "-100%" : "0"})`,
      }}
      data-chat-role="quote-popover"
    >
      {commenting ? (
        <div
          className={`w-[288px] rounded-[var(--r-tile)] border border-[var(--line-2)] bg-[var(--surface-1)] shadow-[var(--shadow-float)] ${
            closing ? "quote-pop-out" : "fade-in-up"
          }`}
        >
          <div className="flex items-center gap-2 px-3 pt-2.5">
            <Quote className="w-3 h-3 shrink-0 text-[var(--accent)]" strokeWidth={2.5} />
            <p className="flex-1 min-w-0 ui-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-4)]">
              Commenter l&apos;extrait
            </p>
            <button
              onClick={close}
              className="-mr-1 p-1 rounded-[var(--r-sm)] text-[var(--text-4)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors duration-150"
              aria-label="Fermer"
              onMouseDown={(e) => e.preventDefault()}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-2 mx-3 flex gap-2 rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2.5 py-2">
            <span
              aria-hidden
              className="w-[2px] shrink-0 rounded-full"
              style={{
                background: "linear-gradient(to bottom, var(--accent), transparent)",
              }}
            />
            <p className="min-w-0 text-[length:var(--t-small)] leading-[1.5] text-[var(--text-3)] line-clamp-3">
              {selection.text}
            </p>
          </div>

          <div className="mx-3 mt-2">
            <textarea
              ref={areaRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              placeholder="Ton commentaire…"
              aria-label="Commentaire sur l'extrait"
              className="w-full resize-none rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-2 text-[length:var(--t-small)] text-[var(--text-1)] placeholder:text-[var(--text-4)] outline-none transition-colors duration-150 focus:border-[var(--accent)]"
            />
          </div>

          <div className="mt-2 mb-2.5 px-3 flex items-center justify-between gap-2">
            <span className="ui-mono text-[10px] text-[var(--text-4)]">Entrée</span>
            <button
              onClick={() => submit()}
              disabled={!comment.trim()}
              className="ui-btn ui-btn--primary ui-btn--xs disabled:opacity-50 active:scale-95 transition-transform duration-150"
              onMouseDown={(e) => e.preventDefault()}
            >
              Ajouter
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCommenting(true)}
          className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--line-2)] bg-[var(--surface-1)] py-1.5 pl-2.5 pr-3 text-[length:var(--t-small)] text-[var(--text-2)] shadow-[var(--shadow-float)] hover:text-[var(--text-1)] hover:border-[var(--text-3)] transition-all duration-150 active:scale-95"
          onMouseDown={(e) => e.preventDefault()}
        >
          <MessageSquarePlus
            className="w-3.5 h-3.5 text-[var(--accent)] transition-transform duration-200 group-hover:-rotate-6"
            strokeWidth={2}
          />
          Commenter
        </button>
      )}
    </div>
  );

  function submit() {
    const trimmed = comment.trim();
    if (!trimmed || !selection) return;
    onAdd({ text: selection.text, comment: trimmed });
    window.getSelection()?.removeAllRanges();
    setClosing(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(close, 150);
  }
}

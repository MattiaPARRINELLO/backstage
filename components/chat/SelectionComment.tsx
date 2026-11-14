"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";

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
  const popRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const close = useCallback(() => {
    setSelection(null);
    setCommenting(false);
    setComment("");
  }, []);

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
        <div className="w-[272px] rounded-[var(--r-tile)] border border-[var(--line-2)] bg-[var(--surface-1)] shadow-[var(--shadow-float)] p-2.5">
          <div className="flex items-start gap-2">
            <p className="flex-1 min-w-0 text-[length:var(--t-small)] leading-[1.5] text-[var(--text-3)] line-clamp-3">
              {selection.text}
            </p>
            <button
              onClick={close}
              className="shrink-0 -mt-0.5 -mr-0.5 p-1 rounded-[var(--r-sm)] text-[var(--text-4)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors duration-150"
              aria-label="Fermer"
              onMouseDown={(e) => e.preventDefault()}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
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
            className="mt-2 w-full resize-none rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-2 text-[length:var(--t-small)] text-[var(--text-1)] placeholder:text-[var(--text-4)] outline-none focus:border-[var(--accent)]"
          />
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <button
              onClick={() => submit()}
              disabled={!comment.trim()}
              className="ui-btn ui-btn--primary ui-btn--xs disabled:opacity-50"
              onMouseDown={(e) => e.preventDefault()}
            >
              Ajouter
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCommenting(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-2)] bg-[var(--surface-1)] px-3 py-1.5 text-[length:var(--t-small)] text-[var(--text-2)] shadow-[var(--shadow-float)] hover:text-[var(--text-1)] hover:border-[var(--text-3)] transition-colors duration-150"
          onMouseDown={(e) => e.preventDefault()}
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
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
    close();
  }
}

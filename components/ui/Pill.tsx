import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "warning" | "success" | "danger" | "muted";

/**
 * Puce d'état (une donnée, pas un filtre). La forme et la typographie
 * viennent de `.ui-chip` ; seule la teinte change, jamais une autre taille.
 * `warning` porte la sémantique d'avertissement — pas de décoration.
 */
const toneClasses: Record<Tone, string> = {
  neutral: "text-[var(--text-2)]",
  accent: "border-[var(--accent)]/30 bg-[var(--accent)]/8 text-[var(--accent)]",
  warning: "border-[var(--warning)]/30 bg-[var(--warning)]/8 text-[var(--warning)]",
  success: "border-[var(--success)]/30 bg-[var(--success)]/8 text-[var(--success)]",
  danger: "border-[var(--danger)]/30 bg-[var(--danger)]/8 text-[var(--danger)]",
  muted: "text-[var(--text-3)]",
};

const dotClasses: Record<Tone, string> = {
  neutral: "bg-[var(--text-3)]",
  accent: "bg-[var(--accent)]",
  warning: "bg-[var(--warning)]",
  success: "bg-[var(--success)]",
  danger: "bg-[var(--danger)]",
  muted: "bg-[var(--text-4)]",
};

type PillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  dot?: boolean;
};

export function Pill({ className, tone = "neutral", dot, children, ...rest }: PillProps) {
  return (
    <span className={cn("ui-chip whitespace-nowrap font-medium", toneClasses[tone], className)} {...rest}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[tone])} />}
      {children}
    </span>
  );
}

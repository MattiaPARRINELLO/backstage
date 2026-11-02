"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md";

/**
 * Bouton icône (sans libellé). Même matière que `.ui-btn` : seules la taille
 * et la teinte changent. Le libellé reste obligatoire pour l'accessibilité.
 */
const sizeClasses: Record<Size, string> = {
  xs: "ui-btn--icon ui-btn--xs",
  sm: "ui-btn--icon ui-btn--xs",
  md: "ui-btn--icon ui-btn--sm",
};

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: Size;
  tone?: "default" | "danger";
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "sm", tone = "default", className, children, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "ui-btn shrink-0",
        sizeClasses[size],
        tone === "danger"
          ? "text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10"
          : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

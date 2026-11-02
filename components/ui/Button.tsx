"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

/**
 * Bouton de l'application. Toute l'apparence vient des classes `.ui-btn`
 * (`app/globals.css`) : ce composant ne fait que traduire l'API en variantes.
 * Ne jamais réintroduire de couleur ou de rayon ici — cf. DESIGN.md §5.
 */
const variantClasses: Record<Variant, string> = {
  primary: "ui-btn--primary",
  secondary: "ui-btn--ghost",
  ghost: "ui-btn--quiet",
  outline: "ui-btn--ghost",
  danger: "ui-btn--danger",
};

const sizeClasses: Record<Size, string> = {
  sm: "ui-btn--sm",
  md: "ui-btn--sm",
  lg: "",
  icon: "ui-btn--icon ui-btn--sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "secondary",
    size = "md",
    loading,
    disabled,
    leftIcon,
    rightIcon,
    children,
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "ui-btn select-none disabled:cursor-not-allowed disabled:opacity-55",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden
        />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

"use client";

import { type ReactNode, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "elevated" | "ghost";
  hover?: boolean;
};

/**
 * Carte de l'application. La surface et le rayon viennent de `.ui-card`
 * (`app/globals.css`). Une variante n'invente jamais une valeur : elle change
 * de palier de surface. `elevated` = palier `--surface-2`.
 */
export function Card({
  className,
  variant = "default",
  hover = false,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "ui-card transition-colors duration-200",
        variant === "elevated" && "bg-[var(--surface-2)]",
        variant === "ghost" && "border-transparent bg-transparent",
        hover && "hover:border-[var(--line-2)]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export function CardHeader({
  className,
  title,
  subtitle,
  action,
  children,
  ...rest
}: CardHeaderProps) {
  return (
    <div
      className={cn("flex items-center justify-between border-b border-[var(--line)] px-4 py-3", className)}
      {...rest}
    >
      <div className="min-w-0 flex-1">
        {title && <h3 className="ui-label truncate font-medium">{title}</h3>}
        {subtitle && (
          <p className="mt-0.5 truncate text-[length:var(--t-small)] text-[var(--text-2)]">{subtitle}</p>
        )}
        {children}
      </div>
      {action && <div className="ml-3 shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-3",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

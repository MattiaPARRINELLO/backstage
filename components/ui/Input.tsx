"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Champ de saisie. `.ui-field` est la seule définition d'un champ
 * (`app/globals.css`) ; ce composant l'applique à un `<input>` / `<textarea>`.
 */
const fieldBase =
  "ui-field w-full text-[length:var(--t-body)] placeholder:text-[var(--text-3)] outline-none";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(fieldBase, className)} {...rest} />;
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, "ui-field--area resize-none py-2.5", className)}
      {...rest}
    />
  );
});

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label && <span className="ui-label mb-1.5 block">{label}</span>}
      {children}
      {hint && (
        <span className="mt-1 block text-[length:var(--t-small)] text-[var(--text-4)]">{hint}</span>
      )}
    </label>
  );
}

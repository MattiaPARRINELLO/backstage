export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-[length:var(--t-lead)] font-semibold tracking-[-0.025em] text-[var(--text-1)]">
        {title}
      </h2>
      {description && (
        <p className="mt-1.5 max-w-xl text-[var(--t-small)] leading-relaxed text-[var(--text-3)]">
          {description}
        </p>
      )}
      <div className="mt-4 border-t border-[var(--line)]">{children}</div>
    </section>
  );
}

export function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--line)] py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <p className="text-[length:var(--t-body)] text-[var(--text-1)]">{label}</p>
        {hint && (
          <p className="mt-1 text-[var(--t-small)] leading-relaxed text-[var(--text-3)]">
            {hint}
          </p>
        )}
      </div>
      {children && <div className="shrink-0 sm:text-right">{children}</div>}
    </div>
  );
}

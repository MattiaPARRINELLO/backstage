import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { memo } from "react";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
}

// Memoïsé : le parsing react-markdown + remark-gfm est cher. Un message dont
// le contenu n'a pas changé ne doit jamais être re-parse (re-rendus de la
// conversation à chaque frappe pendant la saisie).
export const Markdown = memo(function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn("text-[length:var(--t-body)] leading-[1.75] text-[var(--text-1)]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        p: ({ children }) => <p className="mb-3.5 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-[var(--text-1)]">{children}</strong>,
        em: ({ children }) => <em className="italic text-[var(--text-2)]">{children}</em>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2 hover:decoration-[var(--accent)]"
          >
            {children}
          </a>
        ),
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          return isInline ? (
            <code
              className="px-1.5 py-0.5 rounded-[var(--r-sm)] bg-[var(--surface-3)] text-[var(--accent-soft)] ui-mono text-[length:var(--t-small)]"
              {...props}
            >
              {children}
            </code>
          ) : (
            <pre className="my-4 p-4 rounded-[var(--r-tile)] bg-[var(--surface-2)] border border-[var(--border-1)] overflow-x-auto">
              <code
                className="ui-mono text-[length:var(--t-small)] leading-relaxed text-[var(--text-1)]"
                {...props}
              >
                {children}
              </code>
            </pre>
          );
        },
        ul: ({ children }) => <ul className="mb-3.5 pl-5 list-disc marker:text-[var(--text-3)]">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3.5 pl-5 list-decimal marker:text-[var(--text-3)]">{children}</ol>,
        li: ({ children }) => <li className="mb-1.5">{children}</li>,
        h1: ({ children }) => <h1 className="text-[length:var(--t-body)] font-bold mb-3 mt-6 first:mt-0 tracking-tight">{children}</h1>,
        h2: ({ children }) => <h2 className="text-[length:var(--t-body)] font-bold mb-3 mt-6 first:mt-0 tracking-tight">{children}</h2>,
        h3: ({ children }) => <h3 className="text-[length:var(--t-body)] font-semibold mb-2 mt-5 first:mt-0">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[var(--accent)]/50 pl-4 my-4 text-[var(--text-2)] italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-5 border-[var(--border-1)]" />,
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto rounded-[var(--r-sm)] border border-[var(--border-1)]">
            <table className="w-full text-[length:var(--t-small)] border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="text-left ui-mono text-[length:var(--t-small)]  text-[var(--text-3)] px-3 py-2 border-b border-[var(--border-1)] bg-[var(--surface-2)]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 border-b border-[var(--border-1)]/60 text-[var(--text-2)] align-top">
            {children}
          </td>
        ),
      }}
    >
      {children}
      </ReactMarkdown>
    </div>
  );
});

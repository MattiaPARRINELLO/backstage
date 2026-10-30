"use client";

import { useRef, useState } from "react";
import { GITHUB_URL, PUBLIC_DEMO } from "@/app/landing-content";

type DemoSource = { kind: string; title: string; detail: string };

type Status = "idle" | "loading" | "done" | "error";

const MAX_INPUT = 400;

/**
 * Mini-démo publique : interroge /api/demo (DeepSeek côté serveur,
 * contexte 100 % fictif). Aucun accès aux données réelles.
 */
export function PublicDemo() {
  const [status, setStatus] = useState<Status>("idle");
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [sources, setSources] = useState<DemoSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const ask = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || status === "loading") return;
    if (trimmed.length > MAX_INPUT) {
      setStatus("error");
      setError(PUBLIC_DEMO.errors.invalid);
      return;
    }
    setStatus("loading");
    setError(null);
    setReply("");
    setSources([]);

    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = (await res.json()) as {
        reply?: string;
        sources?: DemoSource[];
        error?: string;
      };
      if (!res.ok || !data.reply) {
        setStatus("error");
        setError(
          res.status === 429
            ? PUBLIC_DEMO.errors.rate
            : data.error ?? PUBLIC_DEMO.errors.generic
        );
        return;
      }
      setReply(data.reply);
      setSources(data.sources ?? []);
      setStatus("done");
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch {
      setStatus("error");
      setError(PUBLIC_DEMO.errors.generic);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void ask(question);
  };

  return (
    <section id="demo" className="section pubdemo relative">
      <div className="container container--narrow">
        <div className="section__head">
          <p className="section-label">04 — Démonstration</p>
          <h2 className="section-title">{PUBLIC_DEMO.title}</h2>
          <p className="section-lead">{PUBLIC_DEMO.description}</p>
        </div>

        <form onSubmit={onSubmit} className="pubdemo__field mt-10">
          <label htmlFor="demo-input" className="sr-only">
            Votre question pour la démonstration
          </label>
          <input
            id="demo-input"
            type="text"
            value={question}
            maxLength={MAX_INPUT + 50}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={PUBLIC_DEMO.placeholder}
            autoComplete="off"
            className="pubdemo__input"
          />
          <button
            type="submit"
            disabled={status === "loading" || !question.trim()}
            className="pubdemo__submit"
          >
            {status === "loading" ? (
              <span className="pubdemo__spinner" aria-hidden />
            ) : (
              PUBLIC_DEMO.button
            )}
            <span className="sr-only" aria-live="polite">
              {status === "loading" ? "Réponse en cours" : ""}
            </span>
          </button>
        </form>

        {/* Suggestions */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="section-label">Ou demandez</span>
          {PUBLIC_DEMO.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={status === "loading"}
              onClick={() => {
                setQuestion(suggestion);
                void ask(suggestion);
              }}
              className="pubdemo__suggestion"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Erreur */}
        {status === "error" && (
          <p className="pubdemo__error mt-6" role="alert">
            {error}
          </p>
        )}

        {/* Réponse */}
        {reply && (
          <div ref={resultRef} className="pubdemo__result mt-8" aria-live="polite">
            <p className="pubdemo__question">{question}</p>
            <p className="pubdemo__reply">{reply}</p>

            {sources.length > 0 && (
              <div className="mt-6">
                <p className="pubdemo__sources-label">{PUBLIC_DEMO.contextLabel}</p>
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {sources.map((source) => (
                    <li key={source.title} className="pubdemo__source">
                      <span className="pubdemo__source-kind">{source.kind}</span>
                      <p className="pubdemo__source-title">{source.title}</p>
                      <p className="pubdemo__source-detail">{source.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <p className="pubdemo__disclaimer mt-8" role="note">
          {PUBLIC_DEMO.disclaimer}
        </p>

        {/* Après la démonstration */}
        {status === "done" && (
          <div className="pubdemo__after mt-12">
            <h3 className="section-title">{PUBLIC_DEMO.after.title}</h3>
            <p className="section-lead mt-3">{PUBLIC_DEMO.after.text}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href="/login" className="cta-primary">
                {PUBLIC_DEMO.after.loginCta}
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-secondary"
              >
                {PUBLIC_DEMO.after.githubCta}
              </a>
            </div>
            <p className="pubdemo__disclaimer mt-5">{PUBLIC_DEMO.after.note}</p>
          </div>
        )}
      </div>
    </section>
  );
}

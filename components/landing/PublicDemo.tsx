"use client";

import { useRef, useState } from "react";
import type { LandingContent } from "@/app/landing-content";

type DemoSource = { kind: string; title: string; detail: string };

type Status = "idle" | "loading" | "done" | "error";

const MAX_INPUT = 400;

/**
 * Mini-démo publique : interroge /api/demo (contexte 100 % fictif).
 * Aucun accès aux données réelles. La langue de la réponse suit la
 * langue de la page.
 */
export function PublicDemo({ t }: { t: LandingContent }) {
  const [status, setStatus] = useState<Status>("idle");
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [sources, setSources] = useState<DemoSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const demo = t.publicDemo;

  const ask = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || status === "loading") return;
    if (trimmed.length > MAX_INPUT) {
      setStatus("error");
      setError(demo.errors.invalid);
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
        body: JSON.stringify({ message: trimmed, lang: t.locale }),
      });
      const data = (await res.json()) as {
        reply?: string;
        sources?: DemoSource[];
        error?: string;
      };
      if (!res.ok || !data.reply) {
        setStatus("error");
        setError(res.status === 429 ? demo.errors.rate : (data.error ?? demo.errors.generic));
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
      setError(demo.errors.generic);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void ask(question);
  };

  return (
    <section id="demo" className="sec sec--tight">
      <div className="wrap">
        <div className="demo">
          <div className="demo__grid">
            <div>
              <h2 className="h2 mt-5">{demo.title}</h2>
              <p className="lead mt-4">{demo.description}</p>
              <p className="demo__disclaimer">{demo.disclaimer}</p>
            </div>

            <div>
              <form onSubmit={onSubmit} className="demo__field">
                <label htmlFor="demo-input" className="sr-only">
                  {demo.inputLabel}
                </label>
                <input
                  id="demo-input"
                  type="text"
                  value={question}
                  maxLength={MAX_INPUT + 50}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={demo.placeholder}
                  autoComplete="off"
                  className="demo__input"
                />
                <button
                  type="submit"
                  disabled={status === "loading" || !question.trim()}
                  className="btn btn--solid demo__submit"
                >
                  {status === "loading" ? <span className="demo__spinner" aria-hidden /> : demo.button}
                  <span className="sr-only" aria-live="polite">
                    {status === "loading" ? demo.loading : ""}
                  </span>
                </button>
              </form>

              <div className="demo__chips">
                {demo.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={status === "loading"}
                    onClick={() => {
                      setQuestion(suggestion);
                      void ask(suggestion);
                    }}
                    className="demo__suggestion"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {status === "error" && (
                <p className="demo__error" role="alert">
                  {error}
                </p>
              )}

              {reply && (
                <div ref={resultRef} className="demo__result" aria-live="polite">
                  <p className="demo__question">{question}</p>
                  <p className="demo__reply">{reply}</p>

                  {sources.length > 0 && (
                    <div className="mt-7">
                      <p className="demo__sources-label">{demo.contextLabel}</p>
                      <ul className="demo__sources">
                        {sources.map((source) => (
                          <li key={source.title} className="demo__source">
                            <span className="demo__source-kind">{source.kind}</span>
                            <p className="demo__source-title">{source.title}</p>
                            <p className="demo__source-detail">{source.detail}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {status === "done" && (
                <div className="demo__after">
                  <h3>{demo.after.title}</h3>
                  <p className="lead mt-3">{demo.after.text}</p>
                  <div className="demo__after-actions">
                    <a href="/login" className="btn btn--solid">
                      {demo.after.loginCta}
                    </a>
                    <a
                      href={t.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn--ghost"
                    >
                      {demo.after.githubCta}
                    </a>
                  </div>
                  <p className="small mt-5">{demo.after.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useRef, useState } from "react";
import { USE_CASES } from "@/app/landing-content";

/**
 * Trois univers d'usage — un sélecteur sobre et une fiche par usage.
 */
export function UseCaseWorlds() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next =
      e.key === "ArrowRight"
        ? (active + 1) % USE_CASES.cases.length
        : (active - 1 + USE_CASES.cases.length) % USE_CASES.cases.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section id="usages" className="section section--deep worlds relative">
      <div className="container">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="section__head">
            <p className="section-label">05 — Usages</p>
            <h2 className="section-title">{USE_CASES.title}</h2>
          </div>

          <div
            role="tablist"
            aria-label="Choisir un usage"
            className="segmented"
            onKeyDown={onKeyDown}
          >
            {USE_CASES.cases.map((c, i) => (
              <button
                key={c.key}
                ref={(el) => { tabRefs.current[i] = el; }}
                role="tab"
                id={`usecase-tab-${c.key}`}
                aria-selected={i === active}
                aria-controls={`usecase-panel-${c.key}`}
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
                className="segmented__tab"
                data-active={i === active}
              >
                {c.tab}
              </button>
            ))}
          </div>
        </div>

        {USE_CASES.cases.map((c, i) => (
          <div
            key={c.key}
            role="tabpanel"
            id={`usecase-panel-${c.key}`}
            aria-labelledby={`usecase-tab-${c.key}`}
            hidden={i !== active}
            className="mt-10"
          >
            <div className="worlds__card">
              <p className="worlds__mission">« {c.query} »</p>

              <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[1fr_1.1fr]">
                {/* Fragments mobilisés */}
                <div>
                  <p className="worlds__deliverables-label">Fragments reliés</p>
                  <ul className="mt-2">
                    {c.fragments.map((f) => (
                      <li key={f.text} className="worlds__fragment">
                        <span className="worlds__fragment-kind">{f.kind}</span>
                        <span className="worlds__fragment-text">{f.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Réponse */}
                <div className="worlds__answer">
                  <p className="worlds__answer-label">Réponse contextualisée</p>
                  <p className="worlds__answer-text">{c.answer}</p>
                </div>
              </div>

              <p className="worlds__note">{c.note}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

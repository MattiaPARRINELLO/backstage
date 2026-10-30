"use client";

import { MEMORY } from "@/app/landing-content";

/**
 * Section mémoire — se souvenir, relier, garder le contrôle.
 * Trois principes en liste numérotée, puis l'aperçu de la mémoire
 * réelle : chaque fait est éditable et supprimable.
 */
export function MemorySection() {
  return (
    <section id="memoire" className="section section--deep memory relative">
      <div className="container">
        <div className="section__head">
          <p className="section-label">02 — Mémoire</p>
          <h2 className="section-title">{MEMORY.title}</h2>
          <p className="section-lead">{MEMORY.description}</p>
        </div>

        <div className="principle-list">
          {MEMORY.principles.map((principle) => (
            <article key={principle.n} className="principle">
              <span className="principle__n">{principle.n}</span>
              <div>
                <h3 className="principle__title">{principle.title}</h3>
                <p className="principle__desc">{principle.desc}</p>
              </div>
            </article>
          ))}
        </div>

        {/* Aperçu mémoire — données fictives, signalées comme telles */}
        <div className="memory__preview panel">
          <div className="panel__bar">
            <span>Mémoire — aperçu fictif</span>
            <span>3 faits</span>
          </div>
          <ul>
            {[
              { cat: "Contact", text: "Claire V. — attachée de presse, contact accréditations" },
              { cat: "Préférence", text: "Objectif lumineux privilégié en fosse" },
              { cat: "Projet", text: "Série « Scène 2025 » — livraison en cours" },
            ].map((fact) => (
              <li key={fact.text} className="panel__row">
                <span className="panel__cat">{fact.cat}</span>
                <span className="panel__text">{fact.text}</span>
                <span className="panel__actions">modifier · supprimer</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

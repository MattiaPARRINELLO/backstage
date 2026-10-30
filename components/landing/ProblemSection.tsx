"use client";

import { PROBLEM } from "@/app/landing-content";

/**
 * Section du problème — les fragments dispersés, posés comme une
 * liste de relevé : type à gauche, contenu à droite, hairlines.
 * Aucune animation : le contenu se lit, il ne flotte pas.
 */
export function ProblemSection() {
  return (
    <section id="produit" className="section problem relative">
      <div className="container">
        <div className="section__head">
          <p className="section-label">01 — Le problème</p>
          <h2 className="section-title">{PROBLEM.title}</h2>
          <p className="section-lead">{PROBLEM.description}</p>
        </div>

        <ul className="fragment-grid">
          {PROBLEM.fragments.map((fragment) => (
            <li key={fragment.text} className="problem__fragment">
              <span className="problem__fragment-kind">{fragment.kind}</span>
              <span className="problem__fragment-text">{fragment.text}</span>
            </li>
          ))}
        </ul>

        <p className="problem__resolution">{PROBLEM.resolution}</p>
      </div>
    </section>
  );
}

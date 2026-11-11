import type { LandingContent } from "@/app/landing-content";

/**
 * La mémoire : le titre et les trois promesses à gauche, les faits
 * réellement retenus dans une carte sombre à droite. Le contenu du
 * produit est mis en page — ce n'est pas une capture d'écran.
 */
export function MemorySection({ t }: { t: LandingContent }) {
  return (
    <section id="memoire" className="sec" style={{ background: "var(--surface-2)" }}>
      <div className="wrap">
        <div className="mem">
          <div>
            <h2 className="h2 mt-5">{t.memory.title}</h2>
            <p className="lead mt-4">{t.memory.lead}</p>
          </div>

          <div className="facts">
            <div className="facts__head">
              <span className="card__tag">{t.memory.factsLabel}</span>
              <span className="card__count">{t.memory.editable}</span>
            </div>
            <div className="facts__list">
              {t.memory.facts.map((fact) => (
                <div key={fact.text} className="fact">
                  <span className="fact__k">{fact.kind}</span>
                  <span className="fact__v">{fact.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mem__cards">
          {t.memory.principles.map((principle) => (
            <article key={principle.title} className="mini">
              <h3 className="mini__title">{principle.title}</h3>
              <p className="mini__desc">{principle.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

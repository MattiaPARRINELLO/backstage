import { MEMORY } from "@/app/landing-content";
import { reveal } from "./reveal";

/**
 * La mémoire : le titre et les trois promesses à gauche, les faits
 * réellement retenus dans une carte sombre à droite. Le contenu du
 * produit est mis en page — ce n'est pas une capture d'écran.
 */
export function MemorySection() {
  return (
    <section id="memoire" className="sec" style={{ background: "var(--surface-2)" }}>
      <div className="wrap">
        <div className="mem">
          <div>
            <span className="tag" {...reveal(0)}>
              Mémoire
            </span>
            <h2 className="h2 mt-5" {...reveal(60)}>
              {MEMORY.title}
            </h2>
            <p className="lead mt-4" {...reveal(110)}>
              {MEMORY.lead}
            </p>
          </div>

          <div className="facts" {...reveal(90)}>
            <div className="facts__head">
              <span className="card__tag">{MEMORY.factsLabel}</span>
              <span className="card__count">modifiable</span>
            </div>
            <div className="facts__list">
              {MEMORY.facts.map((fact) => (
                <div key={fact.text} className="fact">
                  <span className="fact__k">{fact.kind}</span>
                  <span className="fact__v">{fact.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mem__cards">
          {MEMORY.principles.map((principle, i) => (
            <article key={principle.title} className="mini" {...reveal(60 + i * 60)}>
              <h3 className="mini__title">{principle.title}</h3>
              <p className="mini__desc">{principle.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

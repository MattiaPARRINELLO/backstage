import { GITHUB_URL, SELF_HOST, SELF_HOST_URL } from "@/app/landing-content";
import { reveal } from "./reveal";
import { InstallCommand } from "./InstallCommand";

/**
 * Chez vous : ce que c'est, où tourne la commande, ce que ça garantit.
 * Composition verticale volontaire — une colonne à moitié vide serait
 * un trou, pas une respiration. Le monospace n'apparaît qu'ici.
 */
export function SelfHostSection() {
  return (
    <section id="chez-vous" className="sec">
      <div className="wrap self">
        <div className="sec__head">
          <h2 className="h2" {...reveal(0)}>
            {SELF_HOST.title}
          </h2>
          <p className="lead" {...reveal(70)}>
            {SELF_HOST.lead}
          </p>
        </div>

        <div className="self__terminal" {...reveal(60)}>
          <InstallCommand />
        </div>

        <div className="self__facts">
          {SELF_HOST.facts.map((fact, i) => (
            <article key={fact.title} className="fact" {...reveal(60 + i * 60)}>
              <h3 className="fact__title">{fact.title}</h3>
              <p className="fact__desc">{fact.desc}</p>
            </article>
          ))}
        </div>

        <div className="self__actions" {...reveal(120)}>
          <a
            href={SELF_HOST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--solid"
          >
            {SELF_HOST.cta}
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--quiet"
          >
            {SELF_HOST.codeCta}
          </a>
        </div>
      </div>
    </section>
  );
}

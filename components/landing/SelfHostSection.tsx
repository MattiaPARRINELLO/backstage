import { GITHUB_URL, SELF_HOST, SELF_HOST_URL } from "@/app/landing-content";
import { reveal } from "./reveal";
import { InstallCommand } from "./InstallCommand";

/**
 * Chez vous : les quatre garanties à gauche, la commande d'installation
 * dans un bloc sombre à droite. Le seul monospace de la page qui ne soit
 * pas une étiquette — c'est du vrai code.
 */
export function SelfHostSection() {
  return (
    <section id="chez-vous" className="sec">
      <div className="wrap self">
        <div>
          <span className="tag" {...reveal(0)}>
            Auto-hébergement
          </span>
          <h2 className="h2 mt-5" {...reveal(60)}>
            {SELF_HOST.title}
          </h2>
          <p className="lead mt-4" {...reveal(110)}>
            {SELF_HOST.lead}
          </p>

        </div>

        <div {...reveal(90)}>
          <InstallCommand />
        </div>
      </div>

      <div className="wrap">
        <div className="self__facts">
          {SELF_HOST.facts.map((fact, i) => (
            <article key={fact.title} className="mini" {...reveal(60 + i * 50)}>
              <h3 className="mini__title">{fact.title}</h3>
              <p className="mini__desc">{fact.desc}</p>
            </article>
          ))}
        </div>

        <div className="self__actions" {...reveal(80)}>
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
            className="btn btn--ghost"
          >
            {SELF_HOST.codeCta}
          </a>
        </div>
      </div>
    </section>
  );
}

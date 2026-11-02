import { GITHUB_URL, SELF_HOST, SELF_HOST_URL } from "@/app/landing-content";
import { InstallCommand } from "./InstallCommand";

/**
 * Chez vous : les quatre garanties à gauche, la commande d'installation
 * dans un bloc sombre à droite. Le seul monospace de la page qui ne soit
 * pas une étiquette — c'est du vrai code.
 */
export function SelfHostSection() {
  return (
    <section id="chez-vous" className="sec sec--tight">
      <div className="wrap self">
        <div>
          <h2 className="h2 mt-5">
            {SELF_HOST.title}
          </h2>
          <p className="lead mt-4">
            {SELF_HOST.lead}
          </p>

        </div>

        <div>
          <InstallCommand />
        </div>
      </div>

      <div className="wrap">
        <div className="self__facts">
          {SELF_HOST.facts.map((fact) => (
            <article key={fact.title} className="mini">
              <h3 className="mini__title">{fact.title}</h3>
              <p className="mini__desc">{fact.desc}</p>
            </article>
          ))}
        </div>

        <div className="self__actions">
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

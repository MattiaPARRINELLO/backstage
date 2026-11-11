import type { LandingContent } from "@/app/landing-content";
import { InstallCommand } from "./InstallCommand";

/**
 * Chez vous : les quatre garanties à gauche, la commande d'installation
 * dans un bloc sombre à droite. Le seul monospace de la page qui ne soit
 * pas une étiquette — c'est du vrai code.
 */
export function SelfHostSection({ t }: { t: LandingContent }) {
  return (
    <section id="chez-vous" className="sec sec--tight">
      <div className="wrap self">
        <div>
          <h2 className="h2 mt-5">{t.selfHost.title}</h2>
          <p className="lead mt-4">{t.selfHost.lead}</p>
        </div>

        <div>
          <InstallCommand t={t} />
        </div>
      </div>

      <div className="wrap">
        <div className="self__facts">
          {t.selfHost.facts.map((fact) => (
            <article key={fact.title} className="mini">
              <h3 className="mini__title">{fact.title}</h3>
              <p className="mini__desc">{fact.desc}</p>
            </article>
          ))}
        </div>

        <div className="self__actions">
          <a
            href={t.selfHostUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--solid"
          >
            {t.selfHost.cta}
          </a>
          <a
            href={t.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--ghost"
          >
            {t.selfHost.codeCta}
          </a>
        </div>
      </div>
    </section>
  );
}

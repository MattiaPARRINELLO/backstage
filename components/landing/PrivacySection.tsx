import { PRIVACY } from "@/app/landing-content";

/**
 * Section sécurité — uniquement les garanties vérifiables dans le code :
 * auth par passkey, routes protégées par défaut, secrets serveur,
 * démo isolée, confirmation des actions sensibles, mémoire éditable.
 */
export function PrivacySection() {
  return (
    <section id="securite" className="section control relative">
      <div className="container">
        <div className="section__head">
          <p className="section-label">06 — Sécurité</p>
          <h2 className="section-title">
            {PRIVACY.title} {PRIVACY.titleB}
          </h2>
          <p className="section-lead">{PRIVACY.description}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {PRIVACY.points.map((point, i) => (
            <div key={point.title} className="control__item">
              <span className="control__item-n">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="control__item-title">{point.title}</h3>
                <p className="control__item-desc">{point.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

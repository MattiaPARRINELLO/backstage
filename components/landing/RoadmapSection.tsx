import { GITHUB_URL, ROADMAP, ROADMAP_URL } from "@/app/landing-content";

/**
 * Comptes et clés : le chantier en cours. Une annonce franche, pas une
 * promesse : la section dit ce qui arrive, sur quelle branche, et quelle
 * capacité gratuite est visée.
 */
export function RoadmapSection() {
  return (
    <section id="comptes" className="sec">
      <div className="wrap">
        <div className="sec__head">
          <p className="wip__badge">{ROADMAP.badge}</p>
          <h2 className="h2">{ROADMAP.title}</h2>
          <p className="lead">{ROADMAP.lead}</p>
        </div>

        <div className="self__facts">
          {ROADMAP.facts.map((fact) => (
            <article key={fact.title} className="mini">
              <h3 className="mini__title">{fact.title}</h3>
              <p className="mini__desc">{fact.desc}</p>
            </article>
          ))}
        </div>

        <div className="wip__foot">
          <p className="wip__status mono">
            <span>{ROADMAP.status.label}</span>
            <code>{ROADMAP.status.value}</code>
          </p>

          <div className="self__actions">
            <a
              href={ROADMAP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--solid"
            >
              {ROADMAP.roadmapCta}
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--ghost"
            >
              {ROADMAP.codeCta}
            </a>
          </div>
        </div>

        <p className="small wip__note">{ROADMAP.note}</p>
      </div>
    </section>
  );
}

import type { LandingContent } from "@/app/landing-content";

/**
 * Comptes et clés : le chantier en cours. Une annonce franche, pas une
 * promesse : la section dit ce qui arrive, sur quelle branche, et quelle
 * capacité gratuite est visée.
 */
export function RoadmapSection({ t }: { t: LandingContent }) {
  const roadmap = t.roadmap;

  return (
    <section id="comptes" className="sec">
      <div className="wrap">
        <div className="sec__head">
          <p className="wip__badge">{roadmap.badge}</p>
          <h2 className="h2">{roadmap.title}</h2>
          <p className="lead">{roadmap.lead}</p>
        </div>

        <div className="self__facts">
          {roadmap.facts.map((fact) => (
            <article key={fact.title} className="mini">
              <h3 className="mini__title">{fact.title}</h3>
              <p className="mini__desc">{fact.desc}</p>
            </article>
          ))}
        </div>

        <div className="wip__foot">
          <p className="wip__status mono">
            <span>{roadmap.status.label}</span>
            <code>{roadmap.status.value}</code>
          </p>

          <div className="self__actions">
            <a
              href={t.roadmapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--solid"
            >
              {roadmap.roadmapCta}
            </a>
            <a
              href={t.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--ghost"
            >
              {roadmap.codeCta}
            </a>
          </div>
        </div>

        <p className="small wip__note">{roadmap.note}</p>
      </div>
    </section>
  );
}

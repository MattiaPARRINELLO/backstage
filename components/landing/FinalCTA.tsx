import Link from "next/link";
import type { LandingContent } from "@/app/landing-content";
import { HeroDemoLink } from "./HeroDemoLink";

/**
 * Clôture : le nom à l'échelle de l'affiche, une phrase, trois actions.
 * La page se referme sur la marque.
 */
export function FinalCTA({ t }: { t: LandingContent }) {
  return (
    <section id="fin" className="close">
      <div className="wrap">
        <p className="close__name" aria-hidden>
          Backstage
        </p>

        <div className="close__row">
          <div>
            <h2 className="close__desc">{t.finalCta.title}</h2>
            <p className="close__note">{t.finalCta.note}</p>
          </div>

          <div className="close__actions">
            <HeroDemoLink label={t.finalCta.primaryCta} />
            <Link href="/login" className="btn btn--ghost">
              {t.finalCta.secondaryCta}
            </Link>
            <a
              href={t.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--text"
            >
              {t.finalCta.tertiaryCta}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

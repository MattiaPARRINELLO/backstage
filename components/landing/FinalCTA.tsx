import Link from "next/link";
import { FINAL_CTA, GITHUB_URL } from "@/app/landing-content";
import { reveal } from "./reveal";
import { HeroDemoLink } from "./HeroDemoLink";

/**
 * Clôture : le nom à l'échelle de l'affiche, une phrase, trois actions.
 * La page se referme sur la marque.
 */
export function FinalCTA() {
  return (
    <section id="fin" className="close">
      <div className="wrap">
        <p className="close__name" aria-hidden {...reveal(0)}>
          Backstage
        </p>

        <div className="close__row">
          <div {...reveal(70)}>
            <h2 className="close__desc">{FINAL_CTA.title}</h2>
            <p className="close__note">{FINAL_CTA.note}</p>
          </div>

          <div className="close__actions" {...reveal(130)}>
            <HeroDemoLink label={FINAL_CTA.primaryCta} />
            <Link href="/login" className="btn btn--ghost">
              {FINAL_CTA.secondaryCta}
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--text"
            >
              {FINAL_CTA.tertiaryCta}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

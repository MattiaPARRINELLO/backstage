import { ExternalLink } from "lucide-react";
import { GITHUB_URL, OPEN_SOURCE, SELF_HOST_URL } from "@/app/landing-content";
import { InstallCommand } from "./InstallCommand";

/**
 * Section open source — code public, licence MIT, auto-hébergement.
 * Aucun partenariat suggéré.
 */
export function OpenSourceSection() {
  return (
    <section id="open-source" className="section section--deep opensource relative">
      <div className="container">
        <div className="section__head">
          <p className="section-label">07 — Open source</p>
          <h2 className="section-title">{OPEN_SOURCE.title}</h2>
          <p className="section-lead">{OPEN_SOURCE.description}</p>
        </div>

        <div className="mt-8 max-w-2xl">
          <p className="pubdemo__disclaimer">{OPEN_SOURCE.hint}</p>
          <InstallCommand />
        </div>

        <div className="opensource__panel">
          {OPEN_SOURCE.techs.map((tech) => (
            <div key={tech.label} className="opensource__card">
              <p className="opensource__role">{tech.role}</p>
              <p className="opensource__label">{tech.label}</p>
              <p className="opensource__desc">{tech.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="cta-secondary">
            <ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            {OPEN_SOURCE.cta}
          </a>
          <a href={SELF_HOST_URL} target="_blank" rel="noopener noreferrer" className="cta-secondary">
            {OPEN_SOURCE.selfHostCta}
          </a>
        </div>

        <p className="mt-8 text-[13px] text-[var(--ink-3)]">{OPEN_SOURCE.signature}</p>
      </div>
    </section>
  );
}

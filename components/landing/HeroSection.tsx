import type { LandingContent } from "@/app/landing-content";
import { reveal } from "./reveal";
import { HeroDemoLink } from "./HeroDemoLink";

/**
 * Premier écran : le titre à l'échelle de l'affiche, la carte de
 * contexte qui montre le produit par son contenu, puis l'index des
 * domaines. Aucune capture d'écran.
 */
export function HeroSection({ t }: { t: LandingContent }) {
  return (
    <section id="hero" className="hero">
      <div className="wrap hero__grid">
        <div className="hero__copy">
          <h1 className="hero__title" {...reveal(0)}>
            {t.hero.title}
          </h1>

          <p className="hero__desc" {...reveal(70)}>
            {t.hero.description}
          </p>

          <div className="hero__actions" {...reveal(140)}>
            <HeroDemoLink label={t.hero.primaryCta} />
            <a
              href={t.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--ghost"
            >
              {t.hero.secondaryCta}
            </a>
          </div>

          <p className="hero__meta" {...reveal(210)}>
            <span>MIT</span>
            <span>{t.ui.localData}</span>
            <span>Passkey</span>
            <a href="/login">{t.hero.loginCta}</a>
          </p>
        </div>

        <div className="card hero__card-settle" {...reveal(100)}>
          <div className="card__top">
            <span className="card__tag">{t.context.label}</span>
            <span className="card__count">{t.context.sourcesCount}</span>
          </div>

          <p className="card__q">« {t.context.question} »</p>

          <div className="card__rows">
            {t.context.fragments.map((fragment) => (
              <div key={fragment.text} className="card__row">
                <span className="card__k">{fragment.kind}</span>
                <span>{fragment.text}</span>
              </div>
            ))}
          </div>

          <p className="card__a">{t.context.answer}</p>
          <p className="card__foot">{t.context.foot}</p>
        </div>
      </div>

      <div className="wrap">
        <div className="index">
          {t.modules.items.map((item) => (
            <div key={item.name} className="idx">
              <span className="idx__name">{item.name}</span>
              <span className="idx__note">{item.short}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

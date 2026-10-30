"use client";

import Link from "next/link";
import { ArrowRight, MessageSquare } from "lucide-react";
import { HERO } from "@/app/landing-content";
import { scrollToSection } from "./SmoothScroll";

/**
 * Hero — le texte à gauche, une fiche de contexte réelle à droite.
 * La fiche montre la forme exacte d'une réponse Backstage : la question,
 * les fragments reliés, puis la réponse. Aucune décoration.
 */
export function HeroSection() {
  return (
    <section id="hero" className="hero relative">
      <div className="container hero__inner">
        <div className="hero__copy">
          <h1 className="hero__title">{HERO.title}</h1>
          <p className="hero__desc">{HERO.description}</p>

          <div className="hero__actions">
            <button type="button" onClick={() => scrollToSection("demo")} className="cta-primary">
              {HERO.primaryCta}
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("produit")}
              className="cta-secondary"
            >
              {HERO.secondaryCta}
            </button>
          </div>

          <p className="hero__note">
            <Link href="/login">{HERO.loginCta}</Link>
            {" · "}
            {HERO.note}
          </p>
        </div>

        <div className="hero__card">
          <div className="context-card">
            <div className="context-card__bar">
              <span>{HERO.context.label}</span>
              <span>Fictif</span>
            </div>

            <div className="context-card__body">
              <p className="context-card__ask">
                <MessageSquare className="h-4 w-4" strokeWidth={1.5} />
                <span>{HERO.context.question}</span>
              </p>

              <ul className="context-card__rows">
                {HERO.context.fragments.map((fragment) => (
                  <li key={fragment.text} className="context-row">
                    <span className="context-row__kind">{fragment.kind}</span>
                    <span className="context-row__text">{fragment.text}</span>
                  </li>
                ))}
              </ul>

              <p className="context-card__answer">{HERO.context.answer}</p>
              <p className="context-card__foot">{HERO.context.foot}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

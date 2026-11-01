import Image from "next/image";
import Link from "next/link";
import { HERO } from "@/app/landing-content";
import { reveal } from "./reveal";
import { HeroDemoLink } from "./HeroDemoLink";

/**
 * Premier écran : le titre à l'échelle de l'affiche, une phrase qui
 * dit ce que c'est, une action — puis la vraie application, en grand.
 * Aucune illustration inventée : la capture est celle du produit.
 */
export function HeroSection() {
  return (
    <section id="hero" className="hero">
      <div className="wrap">
        <h1 className="hero__title" {...reveal(0)}>
          {HERO.title}
        </h1>

        <div className="hero__foot">
          <div {...reveal(70)}>
            <p className="hero__desc">{HERO.description}</p>
            <p className="hero__note">
              <Link href="/login">{HERO.loginCta}</Link>
              {" · "}
              {HERO.note}
            </p>
          </div>

          <div className="hero__actions" {...reveal(140)}>
            <HeroDemoLink label={HERO.primaryCta} />
            <a
              href="https://github.com/MattiaPARRINELLO/backstage"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--quiet"
            >
              {HERO.secondaryCta}
            </a>
          </div>
        </div>
      </div>

      <div className="wrap">
        <figure className="hero__shot" {...reveal(200)}>
          <div className="hero__figure">
            <Image
              src={HERO.shot.src}
              alt={HERO.shot.alt}
              width={2880}
              height={1800}
              sizes="(min-width: 1280px) 1280px, 100vw"
              priority
              className="h-auto w-full"
            />
          </div>
          <figcaption className="hero__caption">{HERO.shot.caption}</figcaption>
        </figure>
      </div>
    </section>
  );
}

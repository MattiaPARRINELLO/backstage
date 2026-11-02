import Link from "next/link";
import Image from "next/image";
import { FOOTER } from "@/app/landing-content";

export function LandingFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer__grid">
          <div>
            <div className="flex items-center gap-2.5">
              <Image
                src="/backstage-logo-simple.png"
                alt=""
                width={22}
                height={22}
                className="h-[22px] w-[22px] object-contain"
              />
              <span className="wordmark">Backstage</span>
            </div>
            <p className="footer__tagline">{FOOTER.tagline}</p>
          </div>

          <nav aria-label="Liens de pied de page" className="footer__links">
            {[...FOOTER.links, ...FOOTER.legal].map((link) =>
              "external" in link && link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer__link"
                >
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} href={link.href} className="footer__link">
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>

        <p className="footer__signature">{FOOTER.signature}</p>
      </div>
    </footer>
  );
}

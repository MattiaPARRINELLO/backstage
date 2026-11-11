import Link from "next/link";
import Image from "next/image";
import type { LandingContent } from "@/app/landing-content";

export function LandingFooter({ t }: { t: LandingContent }) {
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
            <p className="footer__tagline">{t.footer.tagline}</p>
          </div>

          <nav aria-label={t.ui.footerLinksLabel} className="footer__links">
            {[...t.footer.links, ...t.footer.legal].map((link) =>
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
            <Link href={t.switchHref} className="footer__link" hrefLang={t.locale === "fr" ? "en" : "fr"}>
              {t.switchLabel}
            </Link>
          </nav>
        </div>

        <p className="footer__signature">{t.footer.signature}</p>
      </div>
    </footer>
  );
}

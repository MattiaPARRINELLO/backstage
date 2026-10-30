import Link from "next/link";
import Image from "next/image";
import { FOOTER, GITHUB_URL } from "@/app/landing-content";

export function LandingFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <Image
                src="/backstage-logo-simple.png"
                alt=""
                width={22}
                height={22}
                className="h-[22px] w-[22px] object-contain"
              />
              <span className="wordmark text-[15px]">Backstage</span>
            </div>
            <p className="site-footer__tagline">{FOOTER.tagline}</p>
          </div>

          <nav
            aria-label="Liens de pied de page"
            className="grid grid-cols-2 gap-x-14 gap-y-1 sm:grid-cols-3"
          >
            {FOOTER.links.map((link) => (
              <Link key={link.label} href={link.href} className="site-footer__link py-1.5">
                {link.label}
              </Link>
            ))}
            {FOOTER.legal.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="site-footer__link py-1.5"
                >
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} href={link.href} className="site-footer__link py-1.5">
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>

        <p className="site-footer__signature">{FOOTER.signature}</p>
      </div>
    </footer>
  );
}

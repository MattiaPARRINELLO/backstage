"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/app/landing-content";
import { scrollToSection } from "./scroll";
import { ThemeToggle } from "./ThemeToggle";

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header data-scrolled={scrolled} className="site-header">
        <div className="site-header__inner">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Backstage, accueil">
            <Image
              src="/backstage-logo-simple.png"
              alt=""
              width={22}
              height={22}
              className="h-[22px] w-[22px] object-contain"
              priority
            />
            <span className="wordmark">Backstage</span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigation principale">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                type="button"
                onClick={() => scrollToSection(link.href.slice(1))}
                className="nav-link"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => scrollToSection("demo")}
              className="nav-cta hidden sm:inline-flex"
            >
              Essayer la démo
            </button>
            <ThemeToggle />
            <Link href="/login" className="nav-link hidden sm:inline-flex">
              Se connecter
            </Link>
            <button
              type="button"
              className="icon-button lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="menu-mobile"
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? (
                <X className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <Menu className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div id="menu-mobile" className="mobile-menu lg:hidden">
          <nav aria-label="Navigation mobile" className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  scrollToSection(link.href.slice(1));
                }}
                className="mobile-menu__link"
              >
                {link.label}
              </button>
            ))}
            <Link href="/login" className="mobile-menu__link">
              Se connecter
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                scrollToSection("demo");
              }}
              className="btn btn--solid mt-2 w-full"
            >
              Essayer la démo
            </button>
          </nav>
        </div>
      )}
    </>
  );
}

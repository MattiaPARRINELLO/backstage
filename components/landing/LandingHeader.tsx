"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/app/landing-content";
import { scrollToSection } from "./SmoothScroll";

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header data-scrolled={scrolled} className="site-header">
        <div className="site-header__inner">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Backstage — accueil">
            <Image
              src="/backstage-logo-simple.png"
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
              priority
            />
            <span className="wordmark">Backstage</span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Navigation principale">
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

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => scrollToSection("demo")}
              className="nav-cta hidden sm:inline-flex"
            >
              Essayer la démo
            </button>
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
              {menuOpen ? <X className="h-4 w-4" strokeWidth={1.5} /> : <Menu className="h-4 w-4" strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="menu-mobile"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="mobile-menu lg:hidden"
          >
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
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  scrollToSection("demo");
                }}
                className="cta-primary mt-2 w-full"
              >
                Essayer la démo
              </button>
              <Link
                href="/login"
                className="mobile-menu__link mt-1 justify-center border-t border-white/[0.08]"
              >
                Se connecter
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

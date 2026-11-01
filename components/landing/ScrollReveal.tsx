"use client";

import { useEffect } from "react";

/**
 * Révèle les blocs `[data-reveal]` une seule fois, à leur entrée.
 * L'état caché n'est activé qu'une fois le script monté : sans JS,
 * tout le contenu reste lisible.
 */
export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (nodes.length === 0) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((n) => n.setAttribute("data-in", "true"));
      return;
    }

    root.setAttribute("data-reveal", "on");

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-in", "true");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );

    nodes.forEach((n) => io.observe(n));

    return () => {
      io.disconnect();
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

/**
 * Deux mouvements, pas trente et un :
 * 1. l'entrée orchestrée du héros, une seule fois ;
 * 2. une dérive très lente des bandeaux photo pendant le défilement.
 * Le reste de la page est posé, sans apparition au scroll.
 */
export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let observer: IntersectionObserver | null = null;

    if (nodes.length > 0) {
      if (reduced) {
        nodes.forEach((n) => n.setAttribute("data-in", "true"));
      } else {
        root.setAttribute("data-reveal", "on");
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              entry.target.setAttribute("data-in", "true");
              observer?.unobserve(entry.target);
            }
          },
          { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
        );
        nodes.forEach((n) => observer?.observe(n));
      }
    }

    if (reduced) return () => observer?.disconnect();

    // Dérive des photos : transform uniquement, bornée à ±20 px.
    const frames = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    if (frames.length === 0) return () => observer?.disconnect();

    let raf = 0;
    const update = () => {
      raf = 0;
      const h = window.innerHeight;
      for (const frame of frames) {
        const rect = frame.getBoundingClientRect();
        const progress = (rect.top + rect.height / 2 - h / 2) / h;
        const shift = Math.max(-1, Math.min(1, progress)) * -20;
        frame.style.setProperty("--shift", shift.toFixed(2));
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}

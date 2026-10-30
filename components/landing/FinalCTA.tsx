"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FINAL_CTA, GITHUB_URL } from "@/app/landing-content";
import { scrollToSection } from "./SmoothScroll";

export function FinalCTA() {
  return (
    <section className="final relative">
      <div className="container">
        <h2 className="final__title">{FINAL_CTA.title}</h2>
        <p className="final__desc">{FINAL_CTA.description}</p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => scrollToSection("demo")} className="cta-primary">
            {FINAL_CTA.primaryCta}
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </button>
          <Link href="/login" className="cta-secondary">
            {FINAL_CTA.secondaryCta}
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-quiet"
          >
            {FINAL_CTA.tertiaryCta}
          </a>
        </div>

        <p className="final__reassurance">{FINAL_CTA.note}</p>
      </div>
    </section>
  );
}

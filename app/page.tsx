import type { Metadata } from "next";
import "./landing.css";
import { InstalledRedirect } from "@/components/landing/InstalledRedirect";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { ContextSection } from "@/components/landing/ContextSection";
import { BoardSection } from "@/components/landing/BoardSection";
import { MemorySection } from "@/components/landing/MemorySection";
import { DayStory } from "@/components/landing/DayStory";
import { PublicDemo } from "@/components/landing/PublicDemo";
import { SelfHostSection } from "@/components/landing/SelfHostSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Backstage — Votre second cerveau personnel",
  description:
    "Backstage réunit vos mails, vos cours, votre agenda, vos photos et une IA qui s'en souvient. Un espace personnel privé, installé chez vous.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "Backstage",
    title: "Backstage — Votre second cerveau personnel",
    description:
      "Backstage réunit vos mails, vos cours, votre agenda, vos photos et une IA qui s'en souvient. Un espace personnel privé, installé chez vous.",
    images: [{ url: "/backstage-logo.png", width: 1280, height: 1280, alt: "Backstage" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Backstage — Votre second cerveau personnel",
    description:
      "Backstage réunit vos mails, vos cours, votre agenda, vos photos et une IA qui s'en souvient.",
    images: ["/backstage-logo.png"],
  },
};

export default function Home() {
  return (
    <>
      <InstalledRedirect />
      <ScrollReveal />
      <div className="landing-page">
        <LandingHeader />
        <main id="main" className="landing">
          <HeroSection />
          <ContextSection />
          <BoardSection />
          <MemorySection />
          <DayStory />
          <PublicDemo />
          <SelfHostSection />
          <FinalCTA />
        </main>
        <LandingFooter />
      </div>
    </>
  );
}

import type { Metadata } from "next";
import "./landing.css";
import { FR_CONTENT } from "@/app/landing-content";
import { LandingPage } from "@/components/landing/LandingPage";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Backstage — Votre second cerveau personnel",
  description:
    "Backstage réunit vos mails, vos cours, votre agenda, vos photos et une IA qui s'en souvient. Un espace personnel privé, installé chez vous.",
  alternates: {
    canonical: "/",
    languages: { fr: "/", en: "/en" },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    alternateLocale: ["en_US"],
    url: "/",
    siteName: "Backstage",
    title: "Backstage — Votre second cerveau personnel",
    description:
      "Backstage réunit vos mails, vos cours, votre agenda, vos photos et une IA qui s'en souvient.",
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
  return <LandingPage t={FR_CONTENT} />;
}

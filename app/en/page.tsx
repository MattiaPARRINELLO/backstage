import type { Metadata } from "next";
import "../landing.css";
import { EN_CONTENT } from "@/app/landing-content.en";
import { LandingPage } from "@/components/landing/LandingPage";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Backstage — Your personal second brain",
  description:
    "Backstage brings your email, notes, calendar, photos and an AI that remembers them together. A private personal space, installed at home.",
  alternates: {
    canonical: "/en",
    languages: { fr: "/", en: "/en" },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["fr_FR"],
    url: "/en",
    siteName: "Backstage",
    title: "Backstage — Your personal second brain",
    description:
      "Backstage brings your email, notes, calendar, photos and an AI that remembers them together.",
    images: [{ url: "/backstage-logo.png", width: 1280, height: 1280, alt: "Backstage" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Backstage — Your personal second brain",
    description:
      "Backstage brings your email, notes, calendar, photos and an AI that remembers them together.",
    images: ["/backstage-logo.png"],
  },
};

export default function HomeEn() {
  return <LandingPage t={EN_CONTENT} />;
}

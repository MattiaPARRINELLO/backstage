import type { LandingContent } from "@/app/landing-content";
import { InstalledRedirect } from "./InstalledRedirect";
import { ScrollReveal } from "./ScrollReveal";
import { LandingHeader } from "./LandingHeader";
import { HeroSection } from "./HeroSection";
import { DayStory } from "./DayStory";
import { MemorySection } from "./MemorySection";
import { PublicDemo } from "./PublicDemo";
import { RoadmapSection } from "./RoadmapSection";
import { SelfHostSection } from "./SelfHostSection";
import { FinalCTA } from "./FinalCTA";
import { LandingFooter } from "./LandingFooter";
import { PhotoBand } from "./PhotoBand";

/**
 * Composition unique de la landing, paramétrée par la langue.
 * Les pages / et /en ne diffèrent que par l'objet de contenu.
 */
export function LandingPage({ t }: { t: LandingContent }) {
  return (
    <>
      <InstalledRedirect />
      <ScrollReveal />
      <div className="landing-page">
        <LandingHeader t={t} />
        <main id="main" className="landing">
          <HeroSection t={t} />
          <PhotoBand {...t.photos.afterHero} credit={t.photos.credit} priority />
          <DayStory t={t} />
          <PhotoBand {...t.photos.afterStory} credit={t.photos.credit} />
          <MemorySection t={t} />
          <PhotoBand {...t.photos.afterMemory} credit={t.photos.credit} />
          <PublicDemo t={t} />
          <RoadmapSection t={t} />
          <SelfHostSection t={t} />
          <PhotoBand {...t.photos.beforeClose} credit={t.photos.credit} />
          <FinalCTA t={t} />
        </main>
        <LandingFooter t={t} />
      </div>
    </>
  );
}

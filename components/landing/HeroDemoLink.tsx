"use client";

import { ArrowRight } from "lucide-react";
import { scrollToSection } from "./scroll";

/** L'action principale du premier écran : descendre vers la démonstration. */
export function HeroDemoLink({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => scrollToSection("demo")} className="btn btn--solid">
      {label}
      <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
    </button>
  );
}

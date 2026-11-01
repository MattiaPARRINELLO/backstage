import Image from "next/image";
import { MEMORY } from "@/app/landing-content";
import { reveal } from "./reveal";

/**
 * La mémoire : l'écran réel du « Cerveau » à gauche, les trois
 * promesses à droite. L'image prend la hauteur du texte : les deux
 * colonnes se terminent sur la même ligne.
 */
export function MemorySection() {
  return (
    <section id="memoire" className="sec sec--panel">
      <div className="wrap mem">
        <div className="mem__media" {...reveal(0)}>
          <div className="mem__shot">
            <Image
              src="/screenshots/brain.jpg"
              alt="L'écran Cerveau de Backstage : les faits mémorisés, classés par thème, avec un compteur par catégorie."
              width={2880}
              height={1800}
              sizes="(min-width: 960px) 46vw, 100vw"
            />
          </div>
        </div>

        <div>
          <h2 className="h2" {...reveal(60)}>
            {MEMORY.title}
          </h2>
          <p className="lead mt-5" {...reveal(120)}>
            {MEMORY.lead}
          </p>

          <div className="mem__principles">
            {MEMORY.principles.map((principle, i) => (
              <article
                key={principle.title}
                className="principle"
                {...reveal(160 + i * 70)}
              >
                <h3 className="principle__title">{principle.title}</h3>
                <p className="principle__desc">{principle.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import Image from "next/image";
import { MODULES } from "@/app/landing-content";
import { reveal } from "./reveal";

/**
 * Le plateau : six domaines, un seul espace.
 * Trois rangées de formes différentes — 5/4/3, 7/5, puis une bande
 * pleine largeur — pour que la planche ne se lise pas comme une
 * rangée de cartes identiques. La bande ambre ferme le plateau.
 */
const LISTS: Record<string, string[]> = {
  "Agenda, cours, rappels": ["Cours", "Agenda", "Rappels", "En retard"],
  Mémoire: ["Contact", "Préférence", "Projet"],
  Shootings: ["Shooted", "Selecting", "Editing", "Delivered"],
};

const SLOTS = ["mails", "flux", "cours", "memoire", "photos", "code"] as const;

export function BoardSection() {
  return (
    <section id="produit" className="sec">
      <div className="wrap">
        <div className="sec__head">
          <h2 className="h2" {...reveal(0)}>
            {MODULES.title}
          </h2>
          <p className="lead" {...reveal(70)}>
            {MODULES.lead}
          </p>
        </div>

        <div className="board">
          {MODULES.items.map((item, i) => {
            const key = SLOTS[i];
            const list = LISTS[item.name];
            const wide = key === "code";

            return (
              <article
                key={key}
                className={`tile tile--${key}${item.shot ? " tile--shot" : ""}${
                  wide ? " tile--wide" : ""
                }`}
                {...reveal(i * 60)}
              >
                {item.shot ? (
                  <>
                    <div className="tile__shot">
                      <Image
                        src={item.shot.src}
                        alt={item.shot.alt}
                        width={2880}
                        height={1800}
                        sizes={wide ? "(min-width: 900px) 58vw, 100vw" : "(min-width: 720px) 40vw, 100vw"}
                      />
                    </div>
                    <div className="tile__body">
                      <h3 className="tile__name">{item.name}</h3>
                      <p className="tile__line">{item.line}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="tile__name">{item.name}</h3>
                    <p className="tile__line">{item.line}</p>
                    {list && (
                      <ul className="tile__tags">
                        {list.map((entry) => (
                          <li key={entry} className="small">
                            {entry}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </article>
            );
          })}

          <article className="tile tile--note tile--accent" {...reveal(360)}>
            <h3 className="tile__name">Chez vous</h3>
            <p className="tile__line">
              Les données vivent dans un dossier local. Pas de compte à créer chez un tiers.
            </p>
            <code className="tile__cmd">docker compose up -d</code>
            <ul className="tile__tags">
              <li className="small">Fichiers JSON</li>
              <li className="small">Passkey</li>
              <li className="small">Licence MIT</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}

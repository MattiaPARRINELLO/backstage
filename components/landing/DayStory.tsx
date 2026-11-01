"use client";

import { useState } from "react";
import { DAY_STORY } from "@/app/landing-content";
import { reveal } from "./reveal";

const BEATS = DAY_STORY.beats;

type Outcome = "confirm" | "dismiss";

/**
 * Une journée, cinq heures : chaque ligne retrouve le contexte déjà
 * constitué. Plus de section épinglée — on lit, on peut confirmer ou
 * écarter l'action suggérée, et rien d'autre ne bouge.
 */
export function DayStory() {
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});

  return (
    <section id="journee" className="sec">
      <div className="wrap">
        <div className="sec__head">
          <h2 className="h2" {...reveal(0)}>
            {DAY_STORY.title}
          </h2>
          <p className="lead" {...reveal(70)}>
            {DAY_STORY.lead}
          </p>
        </div>

        <div className="day__list">
          {BEATS.map((beat, i) => {
            const outcome = outcomes[i];
            return (
              <article key={beat.time} className="beat" {...reveal(i * 50)}>
                <div>
                  <p className="beat__time">{beat.time}</p>
                  <p className="beat__when">{beat.when}</p>
                </div>

                <div>
                  <p className="beat__query">« {beat.query} »</p>
                  <ul className="beat__connections">
                    {beat.connections.map((connection) => (
                      <li key={connection.text} className="beat__conn">
                        <span className="beat__conn-kind">{connection.kind}</span>
                        <span className="beat__conn-text">{connection.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="beat__answer">{beat.answer}</p>
                  <div className="beat__next">
                    <span className="beat__next-text">{beat.nextStep.text}</span>
                    {outcome ? (
                      <p className="beat__outcome" role="status">
                        {outcome === "confirm"
                          ? beat.nextStep.confirmed
                          : beat.nextStep.dismissed}
                      </p>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="beat__confirm"
                          onClick={() => setOutcomes((o) => ({ ...o, [i]: "confirm" }))}
                        >
                          {beat.nextStep.confirm}
                        </button>
                        <button
                          type="button"
                          className="beat__dismiss"
                          onClick={() => setOutcomes((o) => ({ ...o, [i]: "dismiss" }))}
                        >
                          {beat.nextStep.dismiss}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <p className="lead mt-10" {...reveal(0)}>
          {DAY_STORY.outro}
        </p>
        <p className="small mt-3">{DAY_STORY.disclaimer}</p>
      </div>
    </section>
  );
}

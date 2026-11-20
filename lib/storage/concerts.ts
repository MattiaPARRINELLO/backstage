import type { ConcertPrep, ConcertsData } from "../types";
import { maybeBackup, readOrCreate, writeJsonAtomic } from "../storage-core";
import { webSearch } from "../web";
import { getConcertWeather } from "../weather";

export const defaultConcerts: ConcertsData = {
  events: [
    { id: "1", artist: "Muse", venue: "Accor Arena", date: "2026-07-15", status: "shooted" },
    { id: "2", artist: "Daft Punk", venue: "Stade de France", date: "2026-08-02", status: "shooted" },
    { id: "3", artist: "Phoenix", venue: "Zenith Paris", date: "2026-06-20", status: "selecting" },
    { id: "4", artist: "Justice", venue: "Olympia", date: "2026-05-10", status: "selecting" },
    { id: "5", artist: "Air", venue: "Philharmonie", date: "2026-04-18", status: "editing" },
    { id: "6", artist: "Gojira", venue: "Hellfest", date: "2026-06-29", status: "editing" },
    { id: "7", artist: "Christine & The Queens", venue: "Bercy", date: "2026-03-05", status: "delivered" },
    { id: "8", artist: "L'Imperatrice", venue: "Cigale", date: "2026-02-14", status: "delivered" },
  ],
};

export async function getConcerts(): Promise<ConcertsData> {
  return readOrCreate("concerts.json", defaultConcerts);
}

export async function saveConcerts(data: ConcertsData): Promise<void> {
  await maybeBackup("concerts.json");
  return writeJsonAtomic("concerts.json", data);
}

export async function prepareConcert(concertId: string): Promise<ConcertPrep> {
  const data = await getConcerts();
  const concert = data.events.find((c) => c.id === concertId);
  if (!concert) throw new Error(`Concert ${concertId} introuvable`);

  const weather = await getConcertWeather(concert.venue, concert.date);

  const venueInfo = await webSearch(
    `caractéristiques salle de concert ${concert.venue} capacité fosse photo`
  );

  const checklist = [
    `📷 Boîtier principal (vérifier batterie + carte mémoire)`,
    `📷 Boîtier secondaire (si applicable)`,
    `🔭 Objectif 24-70mm f/2.8 (standard concert)`,
    `🔭 Objectif 70-200mm f/2.8 (zoom)`,
    `🔭 Objectif grand-angle 16-35mm (si fosse)`,
    `⚡ Batteries supplémentaires (×2 minimum)`,
    `💾 Cartes mémoire formatées (×3 minimum)`,
    `🎒 Sac photo adapté (vérifier poids)`,
    `🎟️ Accréditation / Pass imprimé`,
    `🆔 Pièce d'identité`,
    `💧 Bouteille d'eau`,
    `🔦 Lampe torche (si salle sombre)`,
  ];

  return {
    weather,
    venueInfo,
    checklist,
    travelTips: [
      `Arriver 1h30 avant l'ouverture des portes`,
      `Vérifier les restrictions (sac, flash, monopode)`,
      `Repérer la fosse photo et les zones autorisées`,
      `Prévoir des bouchons d'oreilles`,
    ],
  };
}


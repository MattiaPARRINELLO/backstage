/**
 * Meteo OpenWeatherMap (issue #89).
 *
 * Service sortant du noyau, extrait de `lib/storage/concerts.ts` : le stockage
 * ne fait plus d'appel reseau. Les echecs restent encodes dans le texte, comme
 * avant, parce que l'outil meteo et le brief quotidien les presentent tel quel.
 */
import { z } from "zod";

import { getConfig } from "@/lib/config";
import { request as httpRequest } from "@/lib/http";

const API_BASE = "https://api.openweathermap.org/data/2.5";
const TIMEOUT_MS = 10_000;

const currentWeatherSchema = z.object({
  name: z.string(),
  main: z.object({
    temp: z.number(),
    feels_like: z.number(),
    humidity: z.number(),
  }),
  weather: z.array(z.object({ description: z.string() })).min(1),
  wind: z.object({ speed: z.number() }),
});

const forecastSchema = z.object({
  list: z.array(
    z.object({
      dt_txt: z.string(),
      main: z.object({ temp: z.number(), feels_like: z.number() }),
      weather: z.array(z.object({ description: z.string() })).min(1),
    })
  ),
});

type CurrentWeather = z.infer<typeof currentWeatherSchema>;

async function readBody<T>(response: Response, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function fetchCurrent(
  city: string,
  apiKey: string
): Promise<{ response: Response; data: CurrentWeather | null }> {
  const response = await httpRequest(
    `${API_BASE}/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=fr`,
    { label: "openweathermap", timeoutMs: TIMEOUT_MS, retries: 0 }
  );
  return {
    response,
    data: response.ok ? await readBody(response, currentWeatherSchema) : null,
  };
}

/** Meteo detaillee d'une ville, au format historique attendu par l'outil. */
export async function getWeather(city: string): Promise<string> {
  const apiKey = getConfig().OPENWEATHERMAP_API_KEY;
  if (!apiKey) return "Erreur : clé API météo non configurée.";

  try {
    const { response, data } = await fetchCurrent(city, apiKey);
    if (response.status === 404) return `Ville "${city}" introuvable.`;
    if (!response.ok) return `Erreur API météo (${response.status}).`;
    if (!data) return "Erreur : réponse météo invalide.";

    return [
      `**${data.name}** : ${data.main.temp}°C (ressenti ${data.main.feels_like}°C)`,
      `${data.weather[0]?.description ?? ""}`,
      `Humidité : ${data.main.humidity}%`,
      `Vent : ${data.wind.speed} m/s`,
    ].join(" — ");
  } catch (err) {
    return `Erreur : ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** Resume court pour le brief quotidien ; chaine vide si la meteo manque. */
export async function getWeatherSummary(city: string): Promise<string> {
  const apiKey = getConfig().OPENWEATHERMAP_API_KEY;
  if (!apiKey) return "";

  try {
    const { response, data } = await fetchCurrent(city, apiKey);
    if (!response.ok || !data) return "";
    return `${data.main.temp}°C (ressenti ${data.main.feels_like}°C), ${data.weather[0]?.description ?? ""}`;
  } catch {
    return "";
  }
}

/** Prevision pour la date d'un concert, ou message de repli. */
export async function getConcertWeather(venue: string, date: string): Promise<string> {
  const apiKey = getConfig().OPENWEATHERMAP_API_KEY;
  if (!apiKey) return "Météo non disponible";

  try {
    const response = await httpRequest(
      `${API_BASE}/forecast?q=${encodeURIComponent(venue)}&appid=${apiKey}&units=metric&lang=fr`,
      { label: "openweathermap", timeoutMs: TIMEOUT_MS, retries: 0 }
    );
    if (!response.ok) return "Météo non disponible";

    const data = await readBody(response, forecastSchema);
    if (!data) return "Météo non disponible";

    const concertDate = date.slice(0, 10);
    const dayForecast = data.list.find((f) => f.dt_txt.startsWith(concertDate));
    if (!dayForecast) return "Météo non disponible pour cette date";

    return `${dayForecast.main.temp}°C (ressenti ${dayForecast.main.feels_like}°C), ${dayForecast.weather[0]?.description ?? ""}`;
  } catch {
    return "Météo non disponible";
  }
}

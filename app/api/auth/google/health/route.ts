import { NextResponse } from "next/server";
import { getGoogleHealth } from "@/lib/google-client";
import type { GoogleAccountHealth } from "@/lib/google-health";
import { getServerCached, setServerCached } from "@/lib/server-cache";
import { authedRoute } from "@/lib/route";

const HEALTH_CACHE_KEY = "google:health";
const HEALTH_TTL_MS = 5 * 60 * 1000;

export type GoogleHealthResponse = {
  gmail: GoogleAccountHealth;
  calendar: GoogleAccountHealth;
};

export const GET = authedRoute(async (_session) => {
  const cached = getServerCached<GoogleHealthResponse>(HEALTH_CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached);
  }

  const [gmail, calendar] = await Promise.all([
    getGoogleHealth("gmail"),
    getGoogleHealth("calendar"),
  ]);

  const response: GoogleHealthResponse = { gmail, calendar };
  setServerCached(HEALTH_CACHE_KEY, response, HEALTH_TTL_MS);
  return NextResponse.json(response);
});

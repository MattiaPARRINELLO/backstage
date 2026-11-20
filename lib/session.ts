import { getConfig } from "@/lib/config";
import { cookies } from "next/headers";
import { AppError } from "@/lib/errors";
import {
  SESSION_COOKIE,
  CHALLENGE_COOKIE,
  SESSION_TTL_SECONDS,
  CHALLENGE_TTL_SECONDS,
  TOKEN_PURPOSE,
  signJwt,
  verifyJwt,
} from "./session-core";

export {
  SESSION_COOKIE,
  CHALLENGE_COOKIE,
  SESSION_TTL_SECONDS,
  CHALLENGE_TTL_SECONDS,
  TOKEN_PURPOSE,
  signJwt,
  verifyJwt,
};

const cookieOptions = {
  httpOnly: true,
  get secure() {
    return getConfig().NODE_ENV === "production";
  },
  sameSite: "lax" as const,
  path: "/",
};

export async function createSession(userId: string): Promise<void> {
  const token = await signJwt({
    sub: userId,
    purpose: TOKEN_PURPOSE.session,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    ...cookieOptions,
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

export async function requireSession(): Promise<{ userId: string }> {
  const session = await getSession();
  if (!session) throw new AppError("unauthenticated", "Non authentifié");
  return session;
}

export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyJwt<{ sub: string }>(token, TOKEN_PURPOSE.session);
  if (!payload) return null;

  return { userId: payload.sub };
}

export async function createChallenge(challenge: string): Promise<void> {
  const token = await signJwt({
    challenge,
    purpose: TOKEN_PURPOSE.challenge,
    exp: Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS,
  });

  const cookieStore = await cookies();
  cookieStore.set(CHALLENGE_COOKIE, token, {
    ...cookieOptions,
    maxAge: CHALLENGE_TTL_SECONDS,
  });
}

export async function consumeChallenge(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CHALLENGE_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyJwt<{ challenge: string }>(token, TOKEN_PURPOSE.challenge);
  if (!payload) return null;

  cookieStore.set(CHALLENGE_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });

  return payload.challenge;
}

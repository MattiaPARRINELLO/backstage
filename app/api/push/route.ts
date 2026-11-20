import { NextResponse } from "next/server";
import { z } from "zod";
import { addSubscription, removeSubscription, getSubscriptions } from "@/lib/push-subscriptions";
import { configureVapid, sendPushNotification } from "@/lib/send-push";
import { AppError } from "@/lib/errors";
import { authedRoute } from "@/lib/route";

// Toutes les opérations exigent une session, y compris le POST d'abonnement :
// sans cette garde, n'importe qui pouvait enregistrer son endpoint et recevoir
// les notifications privées (titres et notes de rappels).
const subscriptionSchema = z.object({
  endpoint: z.string({ error: "Endpoint requis" }).url("Endpoint invalide"),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string({ error: "Cle p256dh requise" }).min(1),
    auth: z.string({ error: "Cle auth requise" }).min(1),
  }),
});

const deleteSchema = z.object({
  endpoint: z.string().url("Endpoint invalide").optional(),
  all: z.boolean().optional(),
});

const testPushSchema = z.object({
  title: z.string().trim().optional(),
  message: z.string().trim().optional(),
});

export const GET = authedRoute(async (_session) => {
  const subs = await getSubscriptions();
  return NextResponse.json({ count: subs.length, endpoints: subs.map((s) => s.endpoint.slice(0, 60) + "...") });
});

export const POST = authedRoute(async (_session, request: Request) => {
  const parsed = subscriptionSchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new AppError("validation", parsed.error.issues[0]?.message ?? "Subscription invalide");
  }
  await addSubscription({ ...parsed.data, expirationTime: parsed.data.expirationTime ?? null });
  console.log("[push subscribe] Nouvelle souscription:", parsed.data.endpoint.slice(0, 60) + "...");
  return NextResponse.json({ ok: true });
});

export const PUT = authedRoute(async (_session, request: Request) => {
  configureVapid();

  const raw = await request.json().catch(() => ({}));
  const parsed = testPushSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("validation", parsed.error.issues[0]?.message ?? "Payload invalide");
  }
  const title = parsed.data.title || "Test BACKSTAGE";
  const message = parsed.data.message || "Ceci est une notification de test";

  const subs = await getSubscriptions();
  if (subs.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, count: 0, endpoints: [] });
  }

  const payload = JSON.stringify({
    title,
    body: message,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "test-notif",
    data: { type: "test", url: "/reminders" },
    requireInteraction: true,
    renotify: true,
    silent: false,
    timestamp: Date.now(),
    vibrate: [300, 150, 300, 150, 300],
  });

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await sendPushNotification(sub.endpoint, sub.keys, payload);
        return { endpoint: sub.endpoint.slice(0, 60) + "...", ok: true };
      } catch (err) {
        const e = err as { statusCode?: number; body?: string; message?: string };
        return { endpoint: sub.endpoint.slice(0, 60) + "...", ok: false, error: e.message || e.body || String(e), statusCode: e.statusCode };
      }
    })
  );

  const succeeded: string[] = [];
  const errors: { endpoint: string; error: string; statusCode?: number }[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value.ok) {
        succeeded.push(r.value.endpoint);
      } else {
        errors.push({ endpoint: r.value.endpoint, error: r.value.error || "Erreur inconnue", statusCode: r.value.statusCode });
      }
    } else {
      errors.push({ endpoint: "unknown", error: "rejected" });
    }
  }

  return NextResponse.json({ sent: succeeded.length, failed: errors.length, count: subs.length, endpoints: succeeded, errors });
});

export const DELETE = authedRoute(async (_session, request: Request) => {
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new AppError("validation", parsed.error.issues[0]?.message ?? "Payload invalide");
  }

  const { endpoint, all } = parsed.data;
  if (all) {
    const subs = await getSubscriptions();
    for (const sub of subs) {
      await removeSubscription(sub.endpoint);
    }
    return NextResponse.json({ ok: true, cleared: subs.length + " web push" });
  }
  if (!endpoint) {
    throw new AppError("validation", "endpoint requis");
  }
  await removeSubscription(endpoint);
  return NextResponse.json({ ok: true });
});

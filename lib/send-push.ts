import webpush from "web-push";

export function getVapidDetails() {
  const subject = process.env.VAPID_SUBJECT || "mailto:backstage@localhost";
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  return { subject, publicKey, privateKey };
}

export function configureVapid() {
  const details = getVapidDetails();
  if (details.publicKey && details.privateKey) {
    webpush.setVapidDetails(details.subject, details.publicKey, details.privateKey);
  }
  return details;
}

/**
 * `urgency: "high"` demande au push service (FCM/APNs/Mozilla) de livrer
 * immédiatement au lieu de regrouper la notif avec le prochain cycle — c'est ce
 * qui la fait apparaître sans délai quand le téléphone est en veille. Le TTL
 * évite qu'un message périmé soit livré des heures plus tard.
 */
export async function sendPushNotification(
  endpoint: string,
  keys: { p256dh: string; auth: string },
  payload: string,
  options: { urgency?: "very-low" | "low" | "normal" | "high"; ttl?: number } = {}
) {
  await webpush.sendNotification({ endpoint, keys }, payload, {
    urgency: options.urgency ?? "high",
    TTL: options.ttl ?? 3600,
  });
}

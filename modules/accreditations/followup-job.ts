import { sendPushToAll } from "@/lib/push-dispatch";

import { buildFollowUpDraft, dueAccreditations } from "./followup";
import { updateAccreditation } from "./service";
import { accreditationsStore } from "./store";

/**
 * Job horaire de relance.
 *
 * Il notifie chaque fiche envoyée dont l'échéance J+7 est atteinte, puis la
 * passe en `follow-up` avec son texte prêt. La marque n'est posée qu'après un
 * envoi réussi : un push raté est retenté à l'heure suivante, et une fiche déjà
 * notifiée n'est jamais relancée.
 *
 * LIMITE ASSUMÉE : ce job n'envoie aucun email. Le module `emails` ne sait que
 * répondre à un fil existant ; l'envoi neuf est #142. La relance est donc une
 * notification plus un brouillon copiable, l'envoi reste manuel.
 */
export async function runAccreditationFollowUpCheck(now = Date.now()): Promise<number> {
  const data = await accreditationsStore.read();
  const due = dueAccreditations(data.accreditations, now);
  let notified = 0;

  for (const entry of due) {
    const payload = JSON.stringify({
      title: `Relance accréditation : ${entry.artist}`,
      body: `${entry.venue} — ${entry.concertDate}. Texte prêt sur la fiche.`,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: `accreditation-${entry.id}`,
      data: { type: "accreditation", accreditationId: entry.id, url: "/m/accreditations" },
      requireInteraction: true,
      renotify: true,
      silent: false,
      timestamp: now,
      vibrate: [300, 150, 300, 150, 300],
    });

    const { sent } = await sendPushToAll(payload);
    if (!sent) continue;

    await updateAccreditation(entry.id, {
      status: "follow-up",
      followUpNotifiedAt: new Date(now).toISOString(),
      followUpDraft: buildFollowUpDraft(entry),
    });
    notified++;
  }

  return notified;
}

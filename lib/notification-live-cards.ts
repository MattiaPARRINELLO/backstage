import { sendPushToAll } from "./push-dispatch";
import { serverLog } from "./logger";

// Cartes « live » (Android 16) : une notification promue reste epinglee jusqu'a
// sa fin prevue, donc on tient un registre de ce qui est affiche pour savoir
// quoi fermer et ne pas re-poster.
//
// - cours : postee 1 h avant, rafraichie chaque minute, fermee au demarrage de
//   la seance ;
// - rappel : postee 1 h avant l'echeance, rafraichie chaque minute, fermee
//   quand le rappel est fait, supprime, ou reporte.
const LIVE_NOTIFS_FILE = "live-notifs.json";

export interface LiveCard {
  tag: string;
  kind: "course" | "reminder";
  /** id du rappel, pour pouvoir le fermer quand il change d'etat. */
  refId?: string;
  subject: string;
  /** Salle du cours (ou notes du rappel). */
  place: string;
  /** Enseignant, affiche dans le corps de la carte de cours. */
  teacher?: string;
  /** Salle seule, pour la puce de la barre d'etat. */
  room?: string;
  /** Demarrage du cours ou echeance du rappel. */
  at: number;
  /**
   * Minutes restantes au moment du dernier envoi : sert a ne rafraichir la
   * carte que quand le compte a rebours (ou la barre de progression) change.
   */
  sentMin?: number;
  /** Tentatives de fermeture deja effectuees (voir `dismissLiveCard`). */
  dismissTries?: number;
}

/**
 * Nombre de ticks (1 min) pendant lesquels on reessaie de fermer une carte
 * dont la consigne de fermeture n'a atteint aucun appareil. Au-dela, on cede :
 * un telephone reste hors ligne des jours ne doit pas faire tourner la boucle.
 */
const MAX_DISMISS_TRIES = 5;

export async function readLiveCards(): Promise<LiveCard[]> {
  const { readJsonSafe } = await import("./storage");
  const data = await readJsonSafe<{ items: Partial<LiveCard>[] }>(LIVE_NOTIFS_FILE, { items: [] });
  // `start` etait le nom du champ avant la generalisation aux rappels.
  return (data.items ?? []).map((item) => ({
    tag: item.tag ?? "",
    kind: item.kind ?? "course",
    refId: item.refId,
    subject: item.subject ?? "",
    place: item.place ?? "",
    teacher: item.teacher,
    room: item.room,
    at: item.at ?? (item as { start?: number }).start ?? 0,
    sentMin: item.sentMin,
    dismissTries: item.dismissTries,
  }));
}

export async function writeLiveCards(mutator: (items: LiveCard[]) => void): Promise<void> {
  const { mutateJson } = await import("./storage-core");
  await mutateJson<{ items: LiveCard[] }>(LIVE_NOTIFS_FILE, { items: [] }, (data) => {
    mutator(data.items);
  });
}

/** Ferme une carte deja affichee, sur les deux canaux. */
export async function dismissLiveCard(tag: string, url: string): Promise<void> {
  const { sent, devices } = await sendPushToAll(
    JSON.stringify({
      title: "BACKSTAGE",
      body: "",
      tag,
      data: { type: "live", url },
      dismiss: true,
    })
  );
  await writeLiveCards((items) => {
    const index = items.findIndex((i) => i.tag === tag);
    if (index < 0) return;
    // La consigne n'est pas arrivee alors qu'un appareil est cense l'ecouter
    // (reseau, appareil eteint) : on garde la carte pour la retenter au tick
    // suivant. Sinon elle restait affichee pour toujours, plus personne ne
    // connaissant son `tag`.
    if (!sent && devices > 0) {
      const card = items[index];
      card.dismissTries = (card.dismissTries ?? 0) + 1;
      if (card.dismissTries < MAX_DISMISS_TRIES) return;
    }
    items.splice(index, 1);
  });
}

/** Ferme la carte d'un rappel (fait, supprime, reporte). */
export async function dismissReminderCard(reminderId: string): Promise<void> {
  try {
    await dismissLiveCard(`reminder-${reminderId}`, "/reminders");
  } catch (err) {
    void serverLog("scheduler", "error", "dismissReminderCard failed", err);
  }
}

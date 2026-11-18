import type { PendingActionReason } from "@/lib/tool-result";

/**
 * Registre serveur des actions réellement proposées à la confirmation.
 *
 * Sans lui, `/api/chat/confirm[-batch]` exécuterait le nom et les arguments
 * fournis par le client : une action pourrait être inventée, substituée ou
 * rejouée. Le registre reste la vraie autorisation (usage unique, arguments
 * figés).
 *
 * Registre en mémoire, process unique : même limite que `lib/rate-limit.ts` et
 * `lib/chat-runs.ts`. Un redéploiement le vide et une instance multiple
 * nécessiterait un stockage partagé ; ce n'est pas le cas de ce déploiement
 * mono-utilisateur.
 */
interface PendingActionEntry {
  expiresAt: number;
  reason: PendingActionReason;
}

const PENDING_ACTION_TTL_MS = 15 * 60 * 1000;
const PENDING_ACTION_MAX = 50;
const pendingActions = new Map<string, PendingActionEntry>();

// Sérialisation canonique : clés triées, `undefined` ignoré, ordre des clés
// indifférent. Le client renvoie des arguments reparsés ; la clé doit être
// identique à celle enregistrée côté serveur.
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue;
      out[key] = canonicalize(source[key]);
    }
    return out;
  }
  return value;
}

/** Cle canonique d'une action : nom + arguments sérialisés de façon stable. */
export function pendingActionKey(name: string, args: Record<string, unknown>): string {
  return `${name}:${JSON.stringify(canonicalize(args))}`;
}

// Purge à chaque accès : une action non confirmée dans les 15 minutes expire.
function purgePendingActions(now = Date.now()): void {
  for (const [key, entry] of pendingActions) {
    if (entry.expiresAt <= now) pendingActions.delete(key);
  }
}

/**
 * Enregistre une action proposée à l'utilisateur. Renvoie sa clé canonique.
 * Le plafond de 50 évince la plus ancienne entrée (ordre d'insertion de Map).
 */
export function registerPendingAction(
  name: string,
  args: Record<string, unknown>,
  reason: PendingActionReason = "policy"
): string {
  purgePendingActions();
  const key = pendingActionKey(name, args);
  if (!pendingActions.has(key) && pendingActions.size >= PENDING_ACTION_MAX) {
    const oldest = pendingActions.keys().next().value;
    if (oldest !== undefined) pendingActions.delete(oldest);
  }
  pendingActions.set(key, { expiresAt: Date.now() + PENDING_ACTION_TTL_MS, reason });
  return key;
}

/** L'action a-t-elle bien été proposée par le serveur et non encore consommée ? */
export function hasPendingAction(name: string, args: Record<string, unknown>): boolean {
  purgePendingActions();
  return pendingActions.has(pendingActionKey(name, args));
}

/**
 * Consomme une action (usage unique) et renvoie sa raison, ou `null` si elle
 * n'a jamais été proposée, a expiré ou a déjà été consommée.
 */
export function consumePendingAction(
  name: string,
  args: Record<string, unknown>
): PendingActionReason | null {
  purgePendingActions();
  const key = pendingActionKey(name, args);
  const entry = pendingActions.get(key);
  if (!entry) return null;
  pendingActions.delete(key);
  return entry.reason;
}

/** Vide le registre. Réservé aux tests (isolation entre cas). */
export function clearPendingActions(): void {
  pendingActions.clear();
}

// Résultat renvoyé au modèle quand une action est bloquée en attente de
// confirmation. Le préfixe permet au client de détecter l'état.
export const ACTION_BLOCKED_PREFIX = "ACTION_BLOCKED:";

export function confirmationMessage(name: string): string {
  return (
    `${ACTION_BLOCKED_PREFIX}${name}. Cette action a un effet externe et exige ` +
    `la confirmation de l'utilisateur. Explique-lui ce que tu veux faire et ` +
    `demande-lui de confirmer. N'exécute PAS l'action toi-meme.`
  );
}

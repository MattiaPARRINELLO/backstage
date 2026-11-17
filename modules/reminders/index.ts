/**
 * Surface publique du module Rappels.
 *
 * `app/` n'importe que ce fichier (règle `app-limite-aux-manifestes`) : le
 * module reste déplaçable et distribuable, son intérieur n'est pas une API.
 */
export { default } from "./module";
export {
  completeReminder,
  listPendingReminders,
  pendingReminders,
  recurReminder,
  snoozeReminder,
  type RecurResult,
} from "./service";

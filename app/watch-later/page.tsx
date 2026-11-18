import { redirect } from "next/navigation";

/**
 * Ancienne URL, conservee pour les favoris et les notifications deja envoyees.
 * La page vit desormais dans le module, servie par la route unique `/m/<id>`.
 */
export default function LegacyWatchLaterPage() {
  redirect("/m/watch-later");
}

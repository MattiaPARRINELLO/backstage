/**
 * Delais d'annonce partages par les cartes de notification.
 *
 * Une seule definition par regle : le calcul du payload (barre de progression)
 * et la selection des elements a annoncer doivent rester d'accord, sinon la
 * carte affiche une duree qui ne correspond pas a sa fenetre reelle.
 */

/** Delai d'annonce des rappels et des cours (meme regle : 1 h avant). */
export const REMINDER_LEAD_MIN = 60;
export const COURSE_LEAD_MIN = 60;

/**
 * Fenetre de rattrapage apres l'echeance : couvre un redemarrage ou une coupure
 * du serveur, sans ressusciter les rappels oublies depuis des semaines (un
 * rappel encore `pending` de l'an dernier ne doit pas surgir aujourd'hui).
 */
export const REMINDER_GRACE_MIN = 6 * 60;

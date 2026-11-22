/**
 * Évaluateur cron pur, à cinq champs, sans dépendance.
 *
 * Format : minute heure jour-du-mois mois jour-de-la-semaine, dans le fuseau
 * local du serveur (mêmes getters que `Date`, comme la crontab de l'hôte).
 * Chaque champ accepte `*`, une valeur, une liste `a,b`, une plage `a-b`, un
 * pas `* /n` ou `a-b/n`. Le jour de la semaine va de 0 (dimanche) à 6, avec 7
 * accepté comme dimanche.
 *
 * Sémantique standard : quand jour-du-mois et jour-de-la-semaine sont tous deux
 * restreints, ils se combinent en OU ; sinon le champ restreint décide seul.
 */

export interface CronSpec {
  readonly minutes: ReadonlySet<number>;
  readonly hours: ReadonlySet<number>;
  readonly daysOfMonth: ReadonlySet<number>;
  readonly months: ReadonlySet<number>;
  readonly daysOfWeek: ReadonlySet<number>;
  readonly dayOfMonthWildcard: boolean;
  readonly dayOfWeekWildcard: boolean;
}

interface ParsedField {
  readonly values: Set<number>;
  readonly wildcard: boolean;
}

function parseField(
  field: string,
  min: number,
  max: number,
  label: string,
  normalize: (value: number) => number = (value) => value
): ParsedField {
  if (!field) throw new Error(`champ ${label} vide`);

  const values = new Set<number>();
  let wildcard = false;

  for (const part of field.split(",")) {
    if (!part) throw new Error(`liste ${label} invalide : element vide`);

    const pieces = part.split("/");
    if (pieces.length > 2) throw new Error(`pas invalide dans ${label} : "${part}"`);
    const bound = pieces[0];
    const stepText = pieces[1];
    if (bound === undefined) throw new Error(`element invalide dans ${label} : "${part}"`);

    let step = 1;
    if (stepText !== undefined) {
      if (!/^\d+$/.test(stepText)) {
        throw new Error(`pas invalide dans ${label} : "${stepText}"`);
      }
      step = Number(stepText);
      if (step < 1) throw new Error(`pas invalide dans ${label} : "${stepText}"`);
    }

    let start: number;
    let end: number;

    if (bound === "*") {
      start = min;
      end = max;
      if (stepText === undefined) wildcard = true;
    } else {
      const range = bound.split("-");
      if (range.length > 2) throw new Error(`plage invalide dans ${label} : "${bound}"`);

      if (range.length === 2) {
        const from = range[0] ?? "";
        const to = range[1] ?? "";
        if (!/^\d+$/.test(from) || !/^\d+$/.test(to)) {
          throw new Error(`plage invalide dans ${label} : "${bound}"`);
        }
        start = Number(from);
        end = Number(to);
      } else {
        if (!/^\d+$/.test(bound)) {
          throw new Error(`valeur invalide dans ${label} : "${bound}"`);
        }
        start = Number(bound);
        end = start;
      }
    }

    if (start < min || start > max || end < min || end > max) {
      throw new Error(`valeur hors bornes dans ${label} (${min}-${max}) : "${bound}"`);
    }
    if (start > end) throw new Error(`plage inversee dans ${label} : "${bound}"`);

    for (let value = start; value <= end; value += step) {
      values.add(normalize(value));
    }
  }

  return { values, wildcard };
}

/** Analyse une expression à cinq champs, en levant une erreur explicite. */
export function parseCron(expression: string): CronSpec {
  if (typeof expression !== "string" || !expression.trim()) {
    throw new Error("expression cron absente");
  }

  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`expression cron a ${fields.length} champ(s), 5 attendus`);
  }

  const minute = fields[0] ?? "";
  const hour = fields[1] ?? "";
  const dayOfMonth = fields[2] ?? "";
  const month = fields[3] ?? "";
  const dayOfWeek = fields[4] ?? "";

  const daysOfMonth = parseField(dayOfMonth, 1, 31, "jour du mois");
  const daysOfWeek = parseField(dayOfWeek, 0, 7, "jour de la semaine", (value) =>
    value === 7 ? 0 : value
  );

  return {
    minutes: parseField(minute, 0, 59, "minute").values,
    hours: parseField(hour, 0, 23, "heure").values,
    daysOfMonth: daysOfMonth.values,
    months: parseField(month, 1, 12, "mois").values,
    daysOfWeek: daysOfWeek.values,
    dayOfMonthWildcard: daysOfMonth.wildcard,
    dayOfWeekWildcard: daysOfWeek.wildcard,
  };
}

/** L'expression correspond-elle à cet instant, dans le fuseau local ? */
export function cronMatches(expression: string, date: Date): boolean {
  const spec = parseCron(expression);

  if (!spec.minutes.has(date.getMinutes())) return false;
  if (!spec.hours.has(date.getHours())) return false;
  if (!spec.months.has(date.getMonth() + 1)) return false;

  const dayOfMonth = spec.daysOfMonth.has(date.getDate());
  const dayOfWeek = spec.daysOfWeek.has(date.getDay());
  const dayMatches =
    spec.dayOfMonthWildcard || spec.dayOfWeekWildcard
      ? dayOfMonth && dayOfWeek
      : dayOfMonth || dayOfWeek;

  return dayMatches;
}

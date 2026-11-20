/**
 * Ecriture d'une ligne de log structuree, sans dependance serveur (pas de
 * `next/headers`, pas de config). `lib/logger.ts` l'enrichit du `reqId` et de la
 * redaction ; `lib/http.ts` l'utilise pour rester importable cote client.
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogLine {
  readonly time: string;
  readonly level: LogLevel;
  readonly module: string;
  readonly msg: string;
  readonly reqId?: string;
  readonly durationMs?: number;
  readonly external?: boolean;
  readonly err?: { readonly name: string; readonly message: string };
}

/** Ecrit une ligne JSON sur le flux correspondant a son niveau. */
export function writeLogLine(entry: LogLine): void {
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

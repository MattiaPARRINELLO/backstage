// ============================================================
// Types partages par la palette de commandes.
// ============================================================

import type { Bell } from "lucide-react";

export interface ResultItem {
  id: string;
  label: string;
  description: string;
  icon: typeof Bell;
  badge: string;
  kind: "command" | "execute";
}

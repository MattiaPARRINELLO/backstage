"use client";

import { GroupActionCard } from "@/components/chat/MessageBlocks";
import type { PendingGroup } from "@/components/chat/use-pending-actions";

interface PendingGroupListProps {
  groups: PendingGroup[];
  confirmBusy: string | null;
  onConfirm: (group: PendingGroup) => void;
  onCancel: (id: string) => void;
}

// Cartes des lots d'actions en attente de confirmation, au-dessus du
// composeur. La liste et son cycle vivent dans `use-pending-actions`.
export function PendingGroupList({
  groups,
  confirmBusy,
  onConfirm,
  onCancel,
}: PendingGroupListProps) {
  return (
    <div className="mb-3 space-y-2">
      {groups.map((g) => (
        <GroupActionCard
          key={g.id}
          summary={g.summary}
          reason={g.reason}
          tools={g.tools}
          busy={confirmBusy === g.id}
          onConfirm={() => onConfirm(g)}
          onCancel={() => onCancel(g.id)}
        />
      ))}
    </div>
  );
}

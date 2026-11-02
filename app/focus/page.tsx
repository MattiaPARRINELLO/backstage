import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";
import { loadFocus } from "@/app/actions/focus";
import { FocusTimer } from "./FocusTimer";

export default async function FocusPage() {
  const state = await loadFocus();
  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 pb-[152px] pt-12 sm:px-6 sm:pt-[88px]">
          <PageHeader
            title="Focus"
            description="Un minuteur, le téléphone qui se tait, et la preuve que la séance a eu lieu."
          />
          <FocusTimer initialState={state} />
        </div>
      </div>
    </AppShell>
  );
}

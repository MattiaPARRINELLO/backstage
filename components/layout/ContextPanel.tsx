"use client";

import { useState, useMemo } from "react";
import { useModulePanels } from "@backstage/module-kit";
import { Sparkles } from "lucide-react";
import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { GmailWidget } from "@/components/widgets/GmailWidget";
import { LeetCodeWidget } from "@/components/widgets/LeetCodeWidget";
import { AccreditationsWidget } from "@/components/widgets/AccreditationsWidget";
import { FluxTimeline } from "@/components/layout/FluxTimeline";
import { useChatContext } from "@/lib/chat-context";
import { cn } from "@/lib/utils";
import { ContextBadge } from "./panel/ContextBadge";
import { ContextualView } from "./panel/ContextualView";
import { PanelHeader } from "./panel/PanelHeader";
import { ViewSwitcher } from "./panel/ViewSwitcher";
import { TOOL_CONTEXT_MAP, VIEWS, pickContextKey, type View } from "./panel/context-data";

export function ContextPanel() {
  const [view, setView] = useState<View>("flux");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const chatCtx = useChatContext();
  const modulePanels = useModulePanels();

  const views = useMemo(
    () => [
      ...VIEWS,
      ...modulePanels.map((panel) => ({
        id: `module:${panel.id}` as View,
        label: panel.label,
      })),
    ],
    [modulePanels]
  );

  const contextKey = pickContextKey(chatCtx.activeTools);
  const lastTool = chatCtx.lastFinishedTool;
  const lastToolKey = lastTool ? TOOL_CONTEXT_MAP[lastTool.name] ?? null : null;
  const activeContext = contextKey ?? lastToolKey;
  const busy = Object.values(chatCtx.activeTools).length > 0;

  return (
    <>
      {chatCtx.busy && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="xl:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] right-3 z-30 w-11 h-11 rounded-full bg-[var(--accent)] text-[var(--background)] shadow-[var(--shadow-float)] flex items-center justify-center"
          aria-label="Ouvrir le contexte"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
        </button>
      )}

      <aside
        aria-label="Panneau de contexte"
        className={cn(
          "ui-card flex flex-col shrink-0 my-3 mr-3 overflow-hidden transition-[width,transform] duration-300 ease-out",
          "xl:relative xl:translate-x-0",
          collapsed ? "xl:w-14" : "xl:w-[340px]",
          mobileOpen
            ? "fixed inset-x-0 bottom-0 top-auto z-40 w-full my-0 mr-0 rounded-b-none rounded-t-[var(--r-card)] pb-[env(safe-area-inset-bottom)]"
            : "hidden xl:flex",
          mobileOpen && "max-h-[82vh]"
        )}
      >
        <PanelHeader
          activeContext={activeContext}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggle={() => {
            if (mobileOpen) {
              setMobileOpen(false);
            } else {
              setCollapsed((c) => !c);
            }
          }}
        >
          {!collapsed && (
            <div className="px-4 pb-3">
              {activeContext ? (
                <ContextBadge contextKey={activeContext} running={busy} />
              ) : (
                <ViewSwitcher view={view} views={views} onChange={setView} />
              )}
            </div>
          )}
        </PanelHeader>

        {!collapsed && (
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 space-y-4">
            {activeContext ? (
              <ContextualView
                contextKey={activeContext}
                runningTools={Object.values(chatCtx.activeTools)}
                lastTool={lastTool}
                onDismissLast={() => chatCtx.dismissLastFinishedTool()}
              />
            ) : view === "flux" ? (
              <div key="flux" className="flux-enter space-y-4">
                <FluxTimeline />
                <div className="pt-1 space-y-3">
                  <GmailWidget />
                  <LeetCodeWidget />
                  <AccreditationsWidget />
                </div>
              </div>
            ) : view.startsWith("module:") ? (
              <div key={view} className="flux-enter space-y-3">
                {modulePanels.find((panel) => `module:${panel.id}` === view)?.node}
              </div>
            ) : (
              <div key={view} className="flux-enter space-y-3">
                {view === "calendar" && <CalendarWidget />}
                {view === "gmail" && <GmailWidget />}
                {view === "leetcode" && <LeetCodeWidget />}
                {view === "photos" && <AccreditationsWidget />}
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

"use server";

import { z } from "zod";

import { runAction } from "@/lib/action";

export type DailyBriefLaunchResult =
  | { sent: boolean; devices: number }
  | { skipped: string };

export async function launchDailyBrief(): Promise<DailyBriefLaunchResult> {
  return runAction(z.object({}), {}, async () => {
    const { triggerDailyBrief } = await import("@/lib/notification-scheduler");
    return triggerDailyBrief("page-test");
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { microsoftGraphFetch, type MicrosoftTodoList, type MicrosoftTodoTask } from "@/lib/microsoft-client";
import { getServerCached, setServerCached, invalidateServerCachePattern } from "@/lib/server-cache";
import { safeErrorMessage } from "@/lib/utils";
import { AppError } from "@/lib/errors";
import { authedRoute } from "@/lib/route";

export type { MicrosoftTodoList, MicrosoftTodoTask };

const TODO_LIST_CACHE_KEY = "todo:lists";
const TODO_TASKS_CACHE_KEY = "todo:tasks";
const TODO_TTL_MS = 2 * 60 * 1000;

// Réponse Graph paginée (max 100 items par page)
type GraphListResponse<T> = { value: T[]; "@odata.nextLink"?: string };

const completeTaskSchema = z
  .object({
    listId: z.string({ error: "listId requis" }).trim().min(1, "listId requis"),
    taskId: z.string({ error: "taskId requis" }).trim().min(1, "taskId requis"),
    completed: z.boolean().optional(),
  })
  .strict();

export const GET = authedRoute(async (_session, request: NextRequest) => {
  const listId = request.nextUrl.searchParams.get("listId");
  const top = request.nextUrl.searchParams.get("top") ?? "50";

  try {
    if (listId) {
      const cacheKey = `${TODO_TASKS_CACHE_KEY}:${listId}:${top}`;
      const cached = getServerCached<{ tasks: MicrosoftTodoTask[] }>(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }

      const data = await microsoftGraphFetch<GraphListResponse<MicrosoftTodoTask>>(
        `/me/todo/lists/${encodeURIComponent(listId)}/tasks?$top=${top}&$orderby=createdDateTime`
      );
      const response = { tasks: data.value };
      setServerCached(cacheKey, response, TODO_TTL_MS);
      return NextResponse.json(response);
    }

    const cached = getServerCached<{ lists: MicrosoftTodoList[] }>(TODO_LIST_CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }

    const data = await microsoftGraphFetch<GraphListResponse<MicrosoftTodoList>>(
      "/me/todo/lists?$top=100"
    );
    const response = { lists: data.value };
    setServerCached(TODO_LIST_CACHE_KEY, response, TODO_TTL_MS);
    return NextResponse.json(response);
  } catch (err) {
    throw new AppError("external_unavailable", safeErrorMessage(err));
  }
});

// Marque une tâche comme terminée (pattern du POST gmail : invalidation du cache).
export const PATCH = authedRoute(async (_session, request: NextRequest) => {
  const raw = await request.json();
  const parsed = completeTaskSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("validation", parsed.error.issues[0]?.message ?? "Payload invalide");
  }

  const { listId, taskId, completed } = parsed.data;
  const status = completed === false ? "notStarted" : "completed";

  try {
    await microsoftGraphFetch<unknown>(
      `/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    );
  } catch (err) {
    throw new AppError("external_unavailable", safeErrorMessage(err));
  }

  invalidateServerCachePattern(/^todo:tasks/);
  return NextResponse.json({ success: true });
});

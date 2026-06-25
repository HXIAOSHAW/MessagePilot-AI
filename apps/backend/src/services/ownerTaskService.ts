import { v4 as uuidv4 } from "uuid";
import type { OwnerTask } from "@orderpilot/shared";
import { saveOwnerTask } from "../db/repositories";

/**
 * Create and persist an owner task.
 */
export async function createOwnerTask(
  params: Omit<OwnerTask, "id" | "status" | "created_at">
): Promise<OwnerTask> {
  const task: OwnerTask = {
    ...params,
    id: uuidv4(),
    status: "open",
    created_at: new Date().toISOString(),
  };

  await saveOwnerTask(task);
  console.log(`[OwnerTaskService] Task created: [${task.priority.toUpperCase()}] ${task.title}`);

  return task;
}

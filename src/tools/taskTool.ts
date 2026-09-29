import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZentaoClient } from "../zentaoClient.js";
import { taskToMarkdown } from "../formatters/taskFormatter.js";
import { buildMcpResponse } from "../utils/mcpResponse.js";

/**
 * Common task types accepted by ZenTao. Kept as a plain string (not a strict
 * enum) because instances can configure custom types; these are documented as
 * the built-in defaults.
 */
const TASK_TYPE_HINT =
  "Task type (one of: design, devel, request, test, study, discuss, ui, affair, misc)";

/**
 * Re-fetch a task's full detail after a write so the response includes the
 * complete, freshly-persisted view (description, history, comments). Falls back
 * to the raw write response if the ID is missing or the fetch fails.
 */
async function formatWrittenTask(
  client: ZentaoClient,
  written: any,
  successHeading: string
) {
  const taskId = written?.id ?? written?.task?.id;
  let data = written;
  if (taskId) {
    try {
      data = await client.getTaskDetails(taskId);
    } catch {
      // Fall back to the write response if the detail fetch fails.
    }
  }

  const downloadedImages: string[] = [];
  const markdown = await taskToMarkdown(data, client, downloadedImages);
  return await buildMcpResponse(`### ${successHeading}\n\n${markdown}`, downloadedImages);
}

/**
 * Register the task create/edit MCP tools on the given server.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to create/update data.
 */
export function registerTaskTools(server: McpServer, client: ZentaoClient): void {
  // ─── Create Task Tool ──────────────────────────────────────────────────────
  server.registerTool(
    "zentao_create_task",
    {
      description: "Create a new task under an execution",
      inputSchema: {
        executionId: z.union([z.string(), z.number()]).describe("Execution ID the task belongs to"),
        name: z.string().describe("Task name"),
        type: z.string().optional().describe(`${TASK_TYPE_HINT}. Defaults to 'devel'.`),
        assignedTo: z.string().optional().describe("User account to assign the task to"),
        estimate: z.number().optional().describe("Estimated hours"),
        pri: z.number().optional().describe("Priority (1=highest .. 4=lowest)"),
        desc: z.string().optional().describe("Task description (plain text or HTML)"),
        story: z.union([z.string(), z.number()]).optional().describe("Related story ID"),
        module: z.union([z.string(), z.number()]).optional().describe("Module ID"),
        parent: z.union([z.string(), z.number()]).optional().describe("Parent task ID (makes this a subtask; must be in the same execution)"),
        estStarted: z.string().optional().describe("Estimated start date (YYYY-MM-DD)"),
        deadline: z.string().optional().describe("Deadline date (YYYY-MM-DD)"),
      },
    },
    async ({ executionId, name, type, assignedTo, estimate, pri, desc, story, module, parent, estStarted, deadline }) => {
      const payload: any = {
        name,
        type: type || "devel",
      };
      if (assignedTo !== undefined) payload.assignedTo = assignedTo;
      if (estimate !== undefined) payload.estimate = estimate;
      if (pri !== undefined) payload.pri = pri;
      if (desc !== undefined) payload.desc = desc;
      if (story !== undefined) payload.story = story;
      if (module !== undefined) payload.module = module;
      if (parent !== undefined) payload.parent = parent;
      if (estStarted !== undefined) payload.estStarted = estStarted;
      if (deadline !== undefined) payload.deadline = deadline;

      const created = await client.createTask(executionId, payload);
      // The REST create endpoint ignores `parent` on some ZenTao versions, but
      // the edit endpoint honours it — link the new task to its parent there.
      const createdId = created?.id ?? created?.task?.id;
      const createdParent = created?.parent ?? created?.task?.parent;
      if (parent !== undefined && createdId && String(createdParent) !== String(parent)) {
        await client.updateTask(createdId, { parent });
      }
      return await formatWrittenTask(client, created, "Successfully created task!");
    }
  );

  // ─── Edit Task Tool ────────────────────────────────────────────────────────
  server.registerTool(
    "zentao_edit_task",
    {
      description: "Edit an existing task's fields (only the fields you provide are changed)",
      inputSchema: {
        taskId: z.union([z.string(), z.number()]).describe("Task ID to edit"),
        name: z.string().optional().describe("New task name"),
        type: z.string().optional().describe(TASK_TYPE_HINT),
        assignedTo: z.string().optional().describe("User account to reassign the task to"),
        estimate: z.number().optional().describe("Estimated hours"),
        consumed: z.number().optional().describe("Consumed hours"),
        left: z.number().optional().describe("Remaining hours"),
        pri: z.number().optional().describe("Priority (1=highest .. 4=lowest)"),
        desc: z.string().optional().describe("Task description (plain text or HTML)"),
        story: z.union([z.string(), z.number()]).optional().describe("Related story ID"),
        module: z.union([z.string(), z.number()]).optional().describe("Module ID"),
        parent: z.union([z.string(), z.number()]).optional().describe("Parent task ID (makes this a subtask; must be in the same execution)"),
        estStarted: z.string().optional().describe("Estimated start date (YYYY-MM-DD)"),
        deadline: z.string().optional().describe("Deadline date (YYYY-MM-DD)"),
      },
    },
    async ({ taskId, name, type, assignedTo, estimate, consumed, left, pri, desc, story, module, parent, estStarted, deadline }) => {
      const payload: any = {};
      if (name !== undefined) payload.name = name;
      if (type !== undefined) payload.type = type;
      if (assignedTo !== undefined) payload.assignedTo = assignedTo;
      if (estimate !== undefined) payload.estimate = estimate;
      if (consumed !== undefined) payload.consumed = consumed;
      if (left !== undefined) payload.left = left;
      if (pri !== undefined) payload.pri = pri;
      if (desc !== undefined) payload.desc = desc;
      if (story !== undefined) payload.story = story;
      if (module !== undefined) payload.module = module;
      if (parent !== undefined) payload.parent = parent;
      if (estStarted !== undefined) payload.estStarted = estStarted;
      if (deadline !== undefined) payload.deadline = deadline;

      await client.updateTask(taskId, payload);
      // The PUT response can be terse; re-fetch by the known ID for a full view.
      return await formatWrittenTask(client, { id: taskId }, "Successfully updated task!");
    }
  );
}

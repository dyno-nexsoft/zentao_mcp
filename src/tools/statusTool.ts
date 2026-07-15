import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZentaoClient } from "../zentaoClient.js";
import { taskToMarkdown } from "../formatters/taskFormatter.js";
import { bugToMarkdown } from "../formatters/bugFormatter.js";
import { buildMcpResponse } from "../utils/mcpResponse.js";

/**
 * Register the task and bug status update MCP tools on the given server.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to update data.
 */
export function registerStatusTools(server: McpServer, client: ZentaoClient): void {
  // ─── Task Status Update Tool ───────────────────────────────────────────────
  server.registerTool(
    "zentao_update_task_status",
    {
      description: "Update the status of a task and optionally add a comment/remark",
      inputSchema: {
        taskId: z.union([z.string(), z.number()]).describe("Task ID"),
        action: z.enum(["start", "finish", "close", "pause", "cancel", "restart"]).describe("Status transition action"),
        comment: z.string().optional().describe("Optional comment/remark to attach to this action"),
        consumed: z.number().optional().describe("Optional hours consumed (used for 'start' or 'finish')"),
        finishedDate: z.string().optional().describe("Optional actual finish date YYYY-MM-DD (used for 'finish', defaults to today)"),
        realStarted: z.string().optional().describe("Optional actual start date YYYY-MM-DD (used for 'start' or 'finish')"),
        assignedTo: z.string().optional().describe("Optional user account to assign to next (used for 'finish' or 'restart')"),
        left: z.number().optional().describe("Optional left hours (used for 'restart')"),
      },
    },
    async ({ taskId, action, comment, consumed, finishedDate, realStarted, assignedTo, left }) => {
      const payload: any = {};
      if (comment !== undefined) payload.comment = comment;

      if (action === "finish") {
        // Fetch task details to get realStarted / estStarted if not provided (Zentao requires them)
        const task = await client.getTaskDetails(taskId);
        payload.realStarted = realStarted || task.realStarted || task.estStarted || new Date().toISOString().split("T")[0];
        payload.finishedDate = finishedDate || new Date().toISOString().split("T")[0];
        payload.consumed = consumed !== undefined ? consumed : (task.consumed || 0);
        if (assignedTo) payload.assignedTo = assignedTo;
      } else if (action === "start") {
        payload.realStarted = realStarted || new Date().toISOString().split("T")[0];
        if (consumed !== undefined) payload.consumed = consumed;
      } else if (action === "restart") {
        if (assignedTo) payload.assignedTo = assignedTo;
        if (left !== undefined) payload.left = left;
      }

      const updatedTask = await client.updateTaskStatus(taskId, action, payload);
      
      const downloadedImages: string[] = [];
      const markdown = await taskToMarkdown(updatedTask, client, downloadedImages);
      const output = `### Successfully updated task status to '${updatedTask.status || "updated"}'!\n\n${markdown}`;
      
      return buildMcpResponse(output, downloadedImages);
    }
  );

  // ─── Bug Status Update Tool ────────────────────────────────────────────────
  server.registerTool(
    "zentao_update_bug_status",
    {
      description: "Update the status of a bug and optionally add a comment/remark",
      inputSchema: {
        bugId: z.union([z.string(), z.number()]).describe("Bug ID"),
        action: z.enum(["resolve", "close", "activate"]).describe("Status transition action"),
        comment: z.string().optional().describe("Optional comment/remark to attach to this action"),
        resolution: z.enum(["fixed", "bydesign", "postponed", "external", "notrepro", "willnotfix"]).optional().describe("Resolution type (required for 'resolve', defaults to 'fixed')"),
        resolvedBuild: z.string().optional().describe("Build ID/name in which the bug was resolved (used for 'resolve', defaults to 'trunk')"),
        resolvedDate: z.string().optional().describe("Optional date of resolution YYYY-MM-DD (used for 'resolve', defaults to today)"),
        assignedTo: z.string().optional().describe("Optional user account to assign to next (used for 'resolve' or 'activate')"),
        openedBuild: z.string().optional().describe("Optional build ID/name where bug was found (used for 'activate')"),
      },
    },
    async ({ bugId, action, comment, resolution, resolvedBuild, resolvedDate, assignedTo, openedBuild }) => {
      const payload: any = {};
      if (comment !== undefined) payload.comment = comment;

      if (action === "resolve") {
        payload.resolution = resolution || "fixed";
        payload.resolvedBuild = resolvedBuild || "trunk";
        payload.resolvedDate = resolvedDate || new Date().toISOString().split("T")[0];
        if (assignedTo) payload.assignedTo = assignedTo;
      } else if (action === "activate") {
        if (assignedTo) payload.assignedTo = assignedTo;
        if (openedBuild) payload.openedBuild = openedBuild;
      }

      const updatedBug = await client.updateBugStatus(bugId, action, payload);
      
      const downloadedImages: string[] = [];
      const markdown = await bugToMarkdown(updatedBug, client, downloadedImages);
      const output = `### Successfully updated bug status to '${updatedBug.status || "updated"}'!\n\n${markdown}`;
      
      return buildMcpResponse(output, downloadedImages);
    }
  );
}

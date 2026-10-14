import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as os from "os";
import * as path from "path";
import { z } from "zod";
import { ZentaoClient } from "../zentaoClient.js";
import { taskToMarkdown } from "../formatters/taskFormatter.js";
import { buildMcpResponse, mcpText } from "../utils/mcpResponse.js";
import { toFileUrl } from "../utils/fileUtils.js";

/**
 * Register the tools that manage existing tasks and bugs beyond edit and
 * status changes: delete, log effort, and download an attachment.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to change data.
 */
export function registerManageTools(server: McpServer, client: ZentaoClient): void {
  server.registerTool(
    "zentao_delete_task",
    {
      description: "Permanently delete a task",
      inputSchema: { taskId: z.union([z.string(), z.number()]).describe("Task ID") },
    },
    async ({ taskId }) => {
      await client.deleteTask(taskId);
      return mcpText(`### Task #${taskId} deleted.`);
    }
  );

  server.registerTool(
    "zentao_delete_bug",
    {
      description: "Permanently delete a bug",
      inputSchema: { bugId: z.union([z.string(), z.number()]).describe("Bug ID") },
    },
    async ({ bugId }) => {
      await client.deleteBug(bugId);
      return mcpText(`### Bug #${bugId} deleted.`);
    }
  );

  server.registerTool(
    "zentao_record_effort",
    {
      description: "Log effort against a task: the hours spent today and the hours still left",
      inputSchema: {
        taskId: z.union([z.string(), z.number()]).describe("Task ID"),
        consumed: z.number().describe("Hours spent in this entry"),
        left: z.number().describe("Hours still left on the task after this entry"),
        work: z.string().optional().describe("What was done"),
        date: z.string().optional().describe("Date of the work YYYY-MM-DD (defaults to today)"),
      },
    },
    async ({ taskId, consumed, left, work, date }) => {
      const payload: any = {
        consumed,
        left,
        date: date || new Date().toISOString().split("T")[0],
      };
      if (work !== undefined) payload.work = work;

      await client.recordTaskEffort(taskId, payload);

      const downloadedImages: string[] = [];
      const task = await client.getTaskDetails(taskId);
      const markdown = await taskToMarkdown(task, client, downloadedImages);
      return await buildMcpResponse(`### Effort logged on task #${taskId}.\n\n${markdown}`, downloadedImages);
    }
  );

  server.registerTool(
    "zentao_download_attachment",
    {
      description: "Download an attachment of a task or bug by its file ID and return the local path",
      inputSchema: {
        fileId: z.union([z.string(), z.number()]).describe("File ID (shown in the Files section of a task or bug)"),
        fileName: z.string().optional().describe("Optional file name to save as; defaults to the file ID"),
      },
    },
    async ({ fileId, fileName }) => {
      const safeName = path.basename(fileName || `zentao_file_${fileId}`);
      const target = path.join(os.tmpdir(), `zentao_download_${fileId}_${safeName}`);
      await client.downloadFile(fileId, target);
      return mcpText(`### Attachment #${fileId} saved.\n\n[${safeName}](${toFileUrl(target)})\n\n\`${target}\``);
    }
  );
}

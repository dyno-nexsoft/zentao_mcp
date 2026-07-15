import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZentaoClient } from "../zentaoClient.js";
import { renderHistoryAndComments } from "../formatters/actionFormatter.js";
import { buildMcpResponse, mcpText } from "../utils/mcpResponse.js";

/**
 * Register the `zentao_get_comments` MCP tool on the given server.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to fetch and process data.
 */
export function registerCommentTool(server: McpServer, client: ZentaoClient): void {
  server.registerTool(
    "zentao_get_comments",
    {
      description: "Get only the history and comments timeline of a task or a bug",
      inputSchema: {
        type: z.enum(["task", "bug"]).describe("Type of the object ('task' or 'bug')"),
        id: z.union([z.string(), z.number()]).describe("Task or Bug ID"),
      },
    },
    async ({ type, id }) => {
      let data: any;
      if (type === "task") {
        data = await client.getTaskDetails(id);
      } else {
        data = await client.getBugDetails(id);
      }

      const downloadedImages: string[] = [];
      const markdown = await renderHistoryAndComments(data.actions, client, downloadedImages);
      
      const title = type === "task" ? `Task #${data.id || id}: ${data.name || ""}` : `Bug #${data.id || id}: ${data.title || ""}`;
      const output = [
        `# History & Comments for ${title}`,
        markdown.trim() || "*No history or comments found.*"
      ].join("\n\n");

      return buildMcpResponse(output, downloadedImages);
    }
  );

  server.registerTool(
    "zentao_add_comment",
    {
      description: "Add a comment/remark to a task or a bug",
      inputSchema: {
        type: z.enum(["task", "bug"]).describe("Type of the object ('task' or 'bug')"),
        id: z.union([z.string(), z.number()]).describe("Task or Bug ID"),
        comment: z.string().describe("Comment content"),
      },
    },
    async ({ type, id, comment }) => {
      const result = await client.addComment(type, id, comment);
      return mcpText(result.message);
    }
  );
}

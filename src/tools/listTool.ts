import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZentaoClient } from "../zentaoClient.js";
import { tasksToMarkdown, bugsToMarkdown } from "../formatters/listFormatter.js";
import { mcpText } from "../utils/mcpResponse.js";

/**
 * Register the list MCP tools on the given server.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to fetch data.
 */
export function registerListTools(server: McpServer, client: ZentaoClient): void {
  // ─── List Tasks Tool ───────────────────────────────────────────────────────
  server.registerTool(
    "zentao_list_tasks",
    {
      description: "List tasks in an execution (optionally filtered by keyword)",
      inputSchema: {
        executionId: z.union([z.string(), z.number()]).describe("Execution ID to list tasks from"),
        keyword: z.string().optional().describe("Optional keyword to filter tasks by name"),
      },
    },
    async ({ executionId, keyword }) => {
      const data = await client.listExecutionTasks(executionId);
      const markdown = tasksToMarkdown(data, client);
      return mcpText(keyword ? `Filtered by keyword: "${keyword}"\n\n${markdown}` : markdown);
    }
  );

  // ── List Bugs Tool ─────────────────────────────────────────────────────────
  server.registerTool(
    "zentao_list_bugs",
    {
      description: "List bugs in a product (optionally filtered by keyword)",
      inputSchema: {
        productId: z.union([z.string(), z.number()]).describe("Product ID to list bugs from"),
        keyword: z.string().optional().describe("Optional keyword to filter bugs by title"),
      },
    },
    async ({ productId, keyword }) => {
      const data = await client.listProductBugs(productId);
      const markdown = bugsToMarkdown(data, client);
      return mcpText(keyword ? `Filtered by keyword "${keyword}"\n\n${markdown}` : markdown);
    }
  );
}
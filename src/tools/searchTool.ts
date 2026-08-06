import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZentaoClient } from "../zentaoClient.js";
import { tasksToMarkdown, bugsToMarkdown, filterByKeyword } from "../formatters/listFormatter.js";
import { mcpText } from "../utils/mcpResponse.js";

/**
 * Register the search MCP tool on the given server.
 *
 * ZenTao has no dedicated full-text search REST endpoint, so this tool
 * fetches a scoped list (execution tasks or product bugs) and filters it
 * client-side by keyword.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to fetch data.
 */
export function registerSearchTool(server: McpServer, client: ZentaoClient): void {
  server.registerTool(
    "zentao_search",
    {
      description: "Search tasks or bugs by keyword within a scope (execution or product)",
      inputSchema: {
        type: z.enum(["task", "bug"]).describe("Entity type to search"),
        keyword: z.string().describe("Keyword to match against task name / bug title"),
        executionId: z.union([z.string(), z.number()]).optional().describe("Scope to search tasks in (execution ID); required when type=task"),
        productId: z.union([z.string(), z.number()]).optional().describe("Scope to search bugs in (product ID); required when type=bug"),
      },
    },
    async ({ type, keyword, executionId, productId }) => {
      if (type === "task") {
        if (!executionId) {
          throw new Error("executionId is required when type='task'");
        }
        const data = await client.listExecutionTasks(executionId);
        const items: any[] = Array.isArray(data) ? data : data.tasks || [];
        const filtered = filterByKeyword(items, keyword);
        return mcpText(tasksToMarkdown(filtered, client));
      }

      if (!productId) {
        throw new Error("productId is required when type='bug'");
      }
      const data = await client.listProductBugs(productId);
      const items: any[] = Array.isArray(data) ? data : data.bugs || [];
      const filtered = filterByKeyword(items, keyword);
      return mcpText(bugsToMarkdown(filtered, client));
    }
  );
}
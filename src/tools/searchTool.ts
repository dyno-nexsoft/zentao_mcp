import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZentaoClient } from "../zentaoClient.js";
import { tasksToMarkdown, bugsToMarkdown, filterItems, SearchFilters } from "../formatters/listFormatter.js";
import { mcpText } from "../utils/mcpResponse.js";

/**
 * Register the search MCP tool on the given server.
 *
 * ZenTao has no dedicated full-text search REST endpoint, so this tool
 * fetches a scoped list (execution tasks or product bugs) and filters it
 * client-side — by keyword, and by any of the other [SearchFilters].
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to fetch data.
 */
export function registerSearchTool(server: McpServer, client: ZentaoClient): void {
  server.registerTool(
    "zentao_search",
    {
      description:
        "Search tasks or bugs within a scope (execution or product), filtering by any " +
        "combination of keyword, status, priority, severity, assignee, and opened-date range",
      inputSchema: {
        type: z.enum(["task", "bug"]).describe("Entity type to search"),
        keyword: z.string().optional().describe("Keyword to match against task name / bug title"),
        executionId: z.union([z.string(), z.number()]).optional().describe("Scope to search tasks in (execution ID); required when type=task"),
        productId: z.union([z.string(), z.number()]).optional().describe("Scope to search bugs in (product ID); required when type=bug"),
        status: z.string().optional().describe("Filter by exact status (e.g. 'active'/'resolved'/'closed' for bugs, 'wait'/'doing'/'done' for tasks)"),
        pri: z.number().optional().describe("Filter by priority (1=highest .. 4=lowest)"),
        severity: z.number().optional().describe("Filter by severity (bugs only, 1=highest .. 4=lowest)"),
        assignedTo: z.string().optional().describe("Filter by assignee's account"),
        openedAfter: z.string().optional().describe("Only bugs opened on/after this date (bugs only, YYYY-MM-DD)"),
        openedBefore: z.string().optional().describe("Only bugs opened on/before this date (bugs only, YYYY-MM-DD)"),
      },
    },
    async ({ type, keyword, executionId, productId, status, pri, severity, assignedTo, openedAfter, openedBefore }) => {
      const filters: SearchFilters = { keyword, status, pri, severity, assignedTo, openedAfter, openedBefore };

      if (type === "task") {
        if (!executionId) {
          throw new Error("executionId is required when type='task'");
        }
        const data = await client.listExecutionTasks(executionId);
        const items: any[] = Array.isArray(data) ? data : data.tasks || [];
        const filtered = filterItems(items, filters);
        return mcpText(tasksToMarkdown(filtered, client));
      }

      if (!productId) {
        throw new Error("productId is required when type='bug'");
      }
      const data = await client.listProductBugs(productId);
      const items: any[] = Array.isArray(data) ? data : data.bugs || [];
      const filtered = filterItems(items, filters);
      return mcpText(bugsToMarkdown(filtered, client));
    }
  );
}
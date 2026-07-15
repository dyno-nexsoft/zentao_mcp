import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZentaoClient } from "../zentaoClient.js";
import { taskToMarkdown } from "../formatters/taskFormatter.js";
import { buildMcpResponse } from "../utils/mcpResponse.js";

/**
 * Register the `zentao_get_task_details` MCP tool on the given server.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to fetch and process data.
 */
export function registerTaskTool(server: McpServer, client: ZentaoClient): void {
  server.registerTool(
    "zentao_get_task_details",
    {
      description: "Get detailed information of a task",
      inputSchema: {
        taskId: z.union([z.string(), z.number()]).describe("Task ID"),
      },
    },
    async ({ taskId }) => {
      const data = await client.getTaskDetails(taskId);
      const downloadedImages: string[] = [];
      const markdown = await taskToMarkdown(data, client, downloadedImages);
      return await buildMcpResponse(markdown, downloadedImages);
    }
  );
}

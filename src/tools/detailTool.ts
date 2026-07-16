import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZentaoClient } from "../zentaoClient.js";
import { taskToMarkdown } from "../formatters/taskFormatter.js";
import { bugToMarkdown } from "../formatters/bugFormatter.js";
import { buildMcpResponse } from "../utils/mcpResponse.js";

/**
 * Register the `zentao_get_details` MCP tool on the given server.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to fetch and process data.
 */
export function registerDetailTool(server: McpServer, client: ZentaoClient): void {
  server.registerTool(
    "zentao_get_details",
    {
      description: "Get detailed information of a task or a bug",
      inputSchema: {
        type: z.enum(["task", "bug"]).describe("Type of the object ('task' or 'bug')"),
        id: z.union([z.string(), z.number()]).describe("Task or Bug ID"),
      },
    },
    async ({ type, id }) => {
      let data: any;
      let markdown: string;
      const downloadedImages: string[] = [];
      
      if (type === "task") {
        data = await client.getTaskDetails(id);
        markdown = await taskToMarkdown(data, client, downloadedImages);
      } else {
        data = await client.getBugDetails(id);
        markdown = await bugToMarkdown(data, client, downloadedImages);
      }
      
      return await buildMcpResponse(markdown, downloadedImages);
    }
  );
}

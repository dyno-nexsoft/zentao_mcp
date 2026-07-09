import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZentaoClient } from "../zentaoClient.js";
import { bugToMarkdown } from "../formatters/bugFormatter.js";
import { buildMcpResponse } from "../utils/mcpResponse.js";

/**
 * Register the `zentao_get_bug_details` MCP tool on the given server.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to fetch and process data.
 */
export function registerBugTool(server: McpServer, client: ZentaoClient): void {
  server.registerTool(
    "zentao_get_bug_details",
    {
      description: "Get detailed information of a bug",
      inputSchema: {
        bugId: z.union([z.string(), z.number()]).describe("Bug ID"),
      },
    },
    async ({ bugId }) => {
      const data = await client.getBugDetails(bugId);
      const downloadedImages: string[] = [];
      const markdown = await bugToMarkdown(data, client, downloadedImages);
      return buildMcpResponse(markdown, downloadedImages);
    }
  );
}

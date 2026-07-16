import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZentaoClient } from "../zentaoClient.js";
import { myWorkToMarkdown } from "../formatters/myWorkFormatter.js";
import { mcpText } from "../utils/mcpResponse.js";

/**
 * Register the `zentao_get_assigned_to_me` MCP tool on the given server.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to fetch and process data.
 */
export function registerMyWorkTool(server: McpServer, client: ZentaoClient): void {
  server.registerTool(
    "zentao_get_assigned_to_me",
    {
      description: "Get tasks and bugs assigned to the current user (configured in environment variables)",
      inputSchema: {},
    },
    async () => {
      const data = await client.getMyWork();
      const markdown = myWorkToMarkdown(data, client);
      return mcpText(markdown);
    }
  );
}

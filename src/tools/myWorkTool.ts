import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZentaoClient } from "../zentaoClient.js";
import {
  myWorkToMarkdown,
  myTasksToMarkdown,
  myBugsToMarkdown,
} from "../formatters/myWorkFormatter.js";
import { mcpText } from "../utils/mcpResponse.js";

/**
 * Register the "assigned to me" MCP tools on the given server.
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

  server.registerTool(
    "zentao_get_my_tasks",
    {
      description: "Get only the tasks assigned to the current user (configured in environment variables)",
      inputSchema: {},
    },
    async () => {
      const data = await client.getMyTasks();
      const markdown = myTasksToMarkdown(data, client);
      return mcpText(markdown);
    }
  );

  server.registerTool(
    "zentao_get_my_bugs",
    {
      description: "Get only the bugs assigned to the current user (configured in environment variables)",
      inputSchema: {},
    },
    async () => {
      const data = await client.getMyBugs();
      const markdown = myBugsToMarkdown(data, client);
      return mcpText(markdown);
    }
  );
}

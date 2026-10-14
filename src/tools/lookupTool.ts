import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZentaoClient } from "../zentaoClient.js";
import {
  executionsToMarkdown,
  productsToMarkdown,
  projectsToMarkdown,
  usersToMarkdown,
} from "../formatters/lookupFormatter.js";
import { mcpText } from "../utils/mcpResponse.js";

/**
 * Register the lookup MCP tools: the products, projects, executions and users
 * whose IDs and accounts the create, edit and assign tools need.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to fetch data.
 */
export function registerLookupTools(server: McpServer, client: ZentaoClient): void {
  server.registerTool(
    "zentao_list_products",
    { description: "List the products (their IDs are needed to create or list bugs)", inputSchema: {} },
    async () => mcpText(productsToMarkdown(await client.listProducts()))
  );

  server.registerTool(
    "zentao_list_projects",
    { description: "List the projects", inputSchema: {} },
    async () => mcpText(projectsToMarkdown(await client.listProjects()))
  );

  server.registerTool(
    "zentao_list_executions",
    {
      description: "List the executions (their IDs are needed to create or list tasks), optionally of one project",
      inputSchema: {
        projectId: z.union([z.string(), z.number()]).optional().describe("Optional project ID to list the executions of"),
      },
    },
    async ({ projectId }) => mcpText(executionsToMarkdown(await client.listExecutions(projectId)))
  );

  server.registerTool(
    "zentao_list_users",
    {
      description: "List the users, to find the account name to assign a task or bug to",
      inputSchema: {
        keyword: z.string().optional().describe("Optional text to match against the account or real name"),
      },
    },
    async ({ keyword }) => mcpText(usersToMarkdown(await client.listUsers(), keyword))
  );
}

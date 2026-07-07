import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";
import * as dotenv from "dotenv";

dotenv.config();

const server = new McpServer({
  name: "Zentao MCP Server",
  version: "1.0.0"
});

registerTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Zentao MCP Server started via stdio.");
}

main().catch(error => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});

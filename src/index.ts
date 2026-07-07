#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";
import * as dotenv from "dotenv";

// Initialize environment variables from .env file
dotenv.config();

// Create the MCP server instance
const server = new McpServer({
  name: "Zentao MCP Server",
  version: "1.0.0"
});

// Register all Zentao-specific tools onto the server
registerTools(server);

/**
 * Main entrypoint of the Zentao MCP Server.
 * Connects the server to a standard input/output (stdio) transport
 * so that MCP clients can communicate with it.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Zentao MCP Server started via stdio.");
}

// Start the server and handle any initialization errors
main().catch(error => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});

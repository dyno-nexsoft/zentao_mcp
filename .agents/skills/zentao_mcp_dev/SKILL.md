---
name: zentao_mcp_dev
description: Guidelines and instructions for developing, testing, and registering tools on the Zentao MCP Server.
---

# Zentao MCP Server Development Skill

This skill provides guidelines and development instructions for maintaining, testing, and expanding the Zentao MCP Server.

## Architecture Overview

The server is built with Node.js and TypeScript, using the Model Context Protocol (MCP) SDK.

- **[index.ts](file:///e:/Projects/zentao_mcp/src/index.ts)**: Configures and boots the MCP Server with stdio transport.
- **[tools.ts](file:///e:/Projects/zentao_mcp/src/tools.ts)**: Defines and registers MCP tools using `server.registerTool`.
- **[zentaoClient.ts](file:///e:/Projects/zentao_mcp/src/zentaoClient.ts)**: Handles authentication, token refresh, caching, and calls the Zentao REST API.

---

## Environment Variables

Ensure `.env` file exists in the root directory with the following variables:
- `ZENTAO_BASE_URL`: The API URL (e.g. `https://example.com/zentao/api.php/v1`).
- `ZENTAO_ACCOUNT`: The account name for login.
- `ZENTAO_PASSWORD`: The login password.

---

## Adding a New MCP Tool

Follow these 3 steps to implement new features/tools:

1. **Update API Client:**
   Add the corresponding REST API call method inside [zentaoClient.ts](file:///e:/Projects/zentao_mcp/src/zentaoClient.ts). 
   - Use `this.get<T>(url)` for cached GET requests.
   - Use `this.client.post(...)` or other methods for mutative requests.

2. **Define a Clean Function:**
   Inside [tools.ts](file:///e:/Projects/zentao_mcp/src/tools.ts), define a clean function (e.g., `cleanTask`, `cleanBug`) to format the raw Zentao response. Only return essential fields. This avoids cluttering the AI agent's context window.

3. **Register the Tool:**
   In [tools.ts](file:///e:/Projects/zentao_mcp/src/tools.ts), call `server.registerTool` inside `registerTools()`.
   - Provide a clear, descriptive tool name (prefixed with `zentao_`).
   - Write a detailed tool description.
   - Define the schema using Zod (`z.object`, `z.union`, etc.).
   - Invoke the clean function and return standard text output.

---

## Running Commands

- **Build Project:**
  ```powershell
  npm run build
  ```

- **Run Dev (Watch Mode):**
  ```powershell
  npm run dev
  ```

- **Run Unit Tests (Jest):**
  ```powershell
  npm run test
  ```

- **Test API Connection Direct:**
  ```powershell
  npm run test:api
  ```

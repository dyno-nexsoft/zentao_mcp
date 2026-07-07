# Zentao MCP Workspace Rules & Guidelines

Welcome! This workspace contains a Model Context Protocol (MCP) server for ZenTao, implemented in TypeScript. Follow these rules when developing in this codebase.

## Development Rules

1. **TypeScript & ESM**:
   - The project uses TypeScript compiled to ES Modules (`"type": "module"` in `package.json`).
   - Import file paths must include the `.js` extension (e.g., `import { ZentaoClient } from "./zentaoClient.js";`).
   
2. **MCP Tools Integration**:
   - Register all MCP tools in `src/tools.ts` using the `server.registerTool` API.
   - Every tool must define its input schema using `zod` validation.
   - Filter and clean API responses before returning them to the client to avoid exceeding context tokens.

3. **API Client & Authentication**:
   - The `ZentaoClient` class in `src/zentaoClient.ts` handles the authentication tokens and caches GET requests.
   - Do not request `/tokens` repeatedly. The client automatically injects the active token and handles token expiration (401 errors).
   
4. **Testing**:
   - Always run unit tests with `npm test` before pushing code.
   - Mock API calls in unit tests (see `tests/zentaoClient.test.ts`) instead of querying the live API.
   - For live API validation, use `npm run test:api`.

## Environment Setup
Make sure you have a `.env` file containing:
```env
ZENTAO_BASE_URL=https://<your-zentao-domain>/zentao/api.php/v1
ZENTAO_ACCOUNT=<account>
ZENTAO_PASSWORD=<password>
```

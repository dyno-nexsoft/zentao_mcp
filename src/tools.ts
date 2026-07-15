/**
 * tools.ts — Public surface of the Zentao MCP tool layer.
 *
 * This file is intentionally thin. It:
 *   1. Creates the shared ZentaoClient singleton.
 *   2. Re-exports formatter functions (bound to the shared client) so
 *      external callers keep the original 2-argument API without changes.
 *   3. Delegates tool registration to focused per-tool modules.
 *
 * To add a new tool: create `src/tools/<name>Tool.ts` and call its
 * register function here — no existing files need to be modified.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZentaoClient } from "./zentaoClient.js";
import {
  taskToMarkdown as _taskToMarkdown,
} from "./formatters/taskFormatter.js";
import {
  bugToMarkdown as _bugToMarkdown,
} from "./formatters/bugFormatter.js";
import { registerTaskTool }     from "./tools/taskTool.js";
import { registerBugTool }      from "./tools/bugTool.js";
import { registerDownloadTool } from "./tools/downloadTool.js";
import { registerCommentTool }  from "./tools/commentTool.js";
import { registerStatusTools }  from "./tools/statusTool.js";

// ─── Shared singleton ────────────────────────────────────────────────────────

const client = new ZentaoClient();

// ─── Backward-compatible re-exports ──────────────────────────────────────────
// The formatter modules now accept `client` as an explicit parameter (DI).
// These wrappers preserve the original 2-arg signature for any existing callers.

/** @see formatters/taskFormatter.ts */
export function taskToMarkdown(
  rawTask: any,
  downloadedImages?: string[]
): Promise<string> {
  return _taskToMarkdown(rawTask, client, downloadedImages);
}

/** @see formatters/bugFormatter.ts */
export function bugToMarkdown(
  rawBug: any,
  downloadedImages?: string[]
): Promise<string> {
  return _bugToMarkdown(rawBug, client, downloadedImages);
}

// ─── Tool registration ────────────────────────────────────────────────────────

/**
 * Registers all Zentao MCP tools on the provided server instance.
 *
 * Available tools:
 * - `zentao_get_task_details`     — Fetch full details of a task by ID.
 * - `zentao_get_bug_details`      — Fetch full details of a bug by ID.
 * - `zentao_download_attachment`  — Download an attachment and save locally.
 * - `zentao_get_comments`         — Fetch history and comments timeline for task/bug.
 * - `zentao_update_task_status`   — Update a task's status with comments.
 * - `zentao_update_bug_status`    — Update a bug's status with comments.
 *
 * @param server The MCP Server instance where the tools will be registered.
 */
export function registerTools(server: McpServer): void {
  registerTaskTool(server, client);
  registerBugTool(server, client);
  registerDownloadTool(server, client);
  registerCommentTool(server, client);
  registerStatusTools(server, client);
}

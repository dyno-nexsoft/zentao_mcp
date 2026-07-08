import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as os from "os";
import * as path from "path";
import fs from "fs";
import { ZentaoClient } from "./zentaoClient.js";
import TurndownService from "turndown";

// ─── Module-level singletons ────────────────────────────────────────────────

const client = new ZentaoClient();
const activeDownloads = new Map<string, Promise<string>>();
const turndownService = new TurndownService();

// ─── Internal helpers (Single Responsibility) ────────────────────────────────

/** Convert HTML to Markdown for better AI readability. */
function htmlToMarkdown(html: string | undefined | null): string {
  if (!html) return '';
  return turndownService.turndown(html);
}

/** Normalize the ZenTao `files` field (can be an array or object) into a flat array. */
function parseFiles(files: any): { id: any; title: string; extension: string; size: any }[] {
  if (!files) return [];
  const mapper = (f: any) => ({
    id: f.id,
    title: f.title || f.name,
    extension: f.extension,
    size: f.size,
  });
  if (Array.isArray(files)) return files.map(mapper);
  if (typeof files === 'object') return Object.values(files).map(mapper);
  return [];
}

/** Format a ZenTao user field (object or string) into a human-readable string. */
function formatUser(user: any): string {
  if (!user) return '';
  if (typeof user === 'object') {
    const name = user.realname || user.account || '';
    const account = user.account ? ` (${user.account})` : '';
    return `${name}${account}`;
  }
  return String(user);
}

/** Format a file size in bytes to a human-readable string (B / KB / MB). */
export function formatSize(bytes: number | string | undefined | null): string {
  if (bytes === undefined || bytes === null || bytes === '') return 'unknown size';
  const numBytes = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(numBytes)) return 'unknown size';
  if (numBytes < 1024) return `${numBytes} B`;
  if (numBytes < 1024 * 1024) return `${(numBytes / 1024).toFixed(2)} KB`;
  return `${(numBytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Build a standard MCP text content response. */
function mcpText(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** Render a list of file attachments as a Markdown section. Returns empty string if none. */
function renderAttachments(files: { id: any; title: string; extension: string; size: any }[]): string {
  if (!files || files.length === 0) return '';
  const lines = files.map(
    (f) => `- 📎 **${f.title}** (ID: ${f.id}, Extension: ${f.extension}, Size: ${formatSize(f.size)})`
  );
  return `\n## Attachments\n${lines.join('\n')}\n`;
}

// ─── Public formatters ───────────────────────────────────────────────────────

/**
 * Format a raw ZenTao task object into a human-readable Markdown document.
 */
export function taskToMarkdown(rawTask: any): string {
  if (!rawTask) return "Task not found.";

  const est = rawTask.estimate ?? 0;
  const cons = rawTask.consumed ?? 0;
  const left = rawTask.left ?? 0;
  const prog = rawTask.progress ?? 0;

  const lines: string[] = [
    `# Task #${rawTask.id}: ${rawTask.name}`,
    '',
    `- **Status**: ${rawTask.status || 'N/A'}`,
    `- **Priority**: ${rawTask.pri || 'N/A'}`,
    `- **Estimate / Consumed / Left**: ${est}h / ${cons}h / ${left}h (${prog}%)`,
  ];

  if (rawTask.openedBy)   lines.push(`- **Opened By**: ${formatUser(rawTask.openedBy)}`);
  if (rawTask.assignedTo) lines.push(`- **Assigned To**: ${formatUser(rawTask.assignedTo)}`);
  if (rawTask.finishedBy) lines.push(`- **Finished By**: ${formatUser(rawTask.finishedBy)}`);
  if (rawTask.closedBy) {
    const reason = rawTask.closedReason ? ` (Reason: ${rawTask.closedReason})` : '';
    lines.push(`- **Closed By**: ${formatUser(rawTask.closedBy)}${reason}`);
  }

  const desc = htmlToMarkdown(rawTask.desc);
  lines.push(`\n## Description\n${desc || '*No description provided.*'}`);
  lines.push(renderAttachments(parseFiles(rawTask.files)));

  return lines.join('\n');
}

/**
 * Format a raw ZenTao bug object into a human-readable Markdown document.
 */
export function bugToMarkdown(rawBug: any): string {
  if (!rawBug) return "Bug not found.";

  const lines: string[] = [
    `# Bug #${rawBug.id}: ${rawBug.title}`,
    '',
    `- **Status**: ${rawBug.status || 'N/A'}`,
    `- **Severity**: ${rawBug.severity || 'N/A'}`,
    `- **Priority**: ${rawBug.pri || 'N/A'}`,
    `- **Type**: ${rawBug.type || 'N/A'}`,
  ];

  if (rawBug.openedBy)   lines.push(`- **Opened By**: ${formatUser(rawBug.openedBy)}`);
  if (rawBug.assignedTo) lines.push(`- **Assigned To**: ${formatUser(rawBug.assignedTo)}`);
  if (rawBug.resolvedBy) {
    const resolution = rawBug.resolution ? ` (Resolution: ${rawBug.resolution})` : '';
    lines.push(`- **Resolved By**: ${formatUser(rawBug.resolvedBy)}${resolution}`);
  }
  if (rawBug.closedBy) lines.push(`- **Closed By**: ${formatUser(rawBug.closedBy)}`);

  const steps = htmlToMarkdown(rawBug.steps);
  lines.push(`\n## Steps to Reproduce\n${steps || '*No steps provided.*'}`);
  lines.push(renderAttachments(parseFiles(rawBug.files)));

  return lines.join('\n');
}

// ─── Download handler (extracted for Single Responsibility) ──────────────────

/**
 * Download a ZenTao attachment to a local path.
 * Deduplicates concurrent requests for the same file.
 */
async function downloadAttachment(fileId: string | number, targetPath: string): Promise<string> {
  if (fs.existsSync(targetPath) && !activeDownloads.has(targetPath)) {
    return `File already exists locally at: ${targetPath}`;
  }

  if (activeDownloads.has(targetPath)) {
    await activeDownloads.get(targetPath);
    return `File downloaded successfully to: ${targetPath}`;
  }

  const downloadPromise = client.downloadFile(fileId, targetPath);
  activeDownloads.set(targetPath, downloadPromise);
  try {
    const savedPath = await downloadPromise;
    return `File downloaded successfully to: ${savedPath}`;
  } finally {
    activeDownloads.delete(targetPath);
  }
}

// ─── Tool registration (Open/Closed: add tools without touching existing ones) ─

/**
 * Registers Zentao-specific tools to the Model Context Protocol (MCP) server.
 *
 * Available Tools:
 * - `zentao_get_task_details`: Fetch full details of a specific task by ID.
 * - `zentao_get_bug_details`: Fetch full details of a specific bug by ID.
 * - `zentao_download_attachment`: Download attachments and save locally.
 *
 * @param server The MCP Server instance where the tools will be registered.
 */
export function registerTools(server: McpServer) {

  server.registerTool(
    "zentao_get_task_details",
    {
      description: "Get detailed information of a task",
      inputSchema: {
        taskId: z.union([z.string(), z.number()]).describe("Task ID"),
      },
    },
    async ({ taskId }) => {
      const data = await client.getTaskDetails(taskId);
      return mcpText(taskToMarkdown(data));
    }
  );

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
      return mcpText(bugToMarkdown(data));
    }
  );

  server.registerTool(
    "zentao_download_attachment",
    {
      description: "Download a file attachment from ZenTao and save it locally",
      inputSchema: {
        fileId: z.union([z.string(), z.number()]).describe("File ID to download"),
        extension: z.string().optional().describe("Optional file extension (e.g., mp4, png)"),
      },
    },
    async ({ fileId, extension }) => {
      const ext = extension ? (extension.startsWith('.') ? extension : `.${extension}`) : '';
      const targetPath = path.join(os.tmpdir(), `zentao_file_${fileId}${ext}`);
      try {
        const message = await downloadAttachment(fileId, targetPath);
        return mcpText(message);
      } catch (error: any) {
        return mcpText(`Failed to download file: ${error.message}`);
      }
    }
  );
}

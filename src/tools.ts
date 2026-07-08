import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as os from "os";
import * as path from "path";
import fs from "fs";
import { ZentaoClient } from "./zentaoClient.js";
import TurndownService from "turndown";

const client = new ZentaoClient();
const activeDownloads = new Map<string, Promise<string>>();
const turndownService = new TurndownService();

/**
 * Registers Zentao-specific tools to the Model Context Protocol (MCP) server.
 * 
 * Available Tools:
 * - `zentao_get_task_details`: Fetch full details of a specific task by ID.
 * - `zentao_get_bug_details`: Fetch full details of a specific bug by ID.
 * - `zentao_download_attachment`: Download attachments (e.g. bug reproduction videos/images) and save locally.
 * 
 * @param server The MCP Server instance where the tools will be registered.
 */
function parseFiles(files: any) {
  if (!files) return [];
  const mapper = (f: any) => ({
    id: f.id,
    title: f.title || f.name,
    extension: f.extension,
    size: f.size
  });
  if (Array.isArray(files)) {
    return files.map(mapper);
  }
  if (typeof files === 'object') {
    return Object.values(files).map(mapper);
  }
  return [];
}

/**
 * Simple utility to convert basic HTML to Markdown for better readability by the AI.
 */
function htmlToMarkdown(html: string | undefined | null): string {
  if (!html) return '';
  return turndownService.turndown(html);
}

export function formatSize(bytes: number | string | undefined | null): string {
  if (bytes === undefined || bytes === null || bytes === '') return 'unknown size';
  const numBytes = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(numBytes)) return 'unknown size';
  if (numBytes < 1024) return `${numBytes} B`;
  if (numBytes < 1024 * 1024) return `${(numBytes / 1024).toFixed(2)} KB`;
  return `${(numBytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatUser(user: any): string {
  if (!user) return '';
  if (typeof user === 'object') {
    const name = user.realname || user.account || '';
    const account = user.account ? ` (${user.account})` : '';
    return `${name}${account}`;
  }
  return String(user);
}

export function taskToMarkdown(rawTask: any): string {
  if (!rawTask) return "Task not found.";
  let md = `# Task #${rawTask.id}: ${rawTask.name}\n\n`;
  md += `- **Status**: ${rawTask.status || 'N/A'}\n`;
  md += `- **Priority**: ${rawTask.pri || 'N/A'}\n`;
  
  const est = rawTask.estimate ?? 0;
  const cons = rawTask.consumed ?? 0;
  const left = rawTask.left ?? 0;
  const prog = rawTask.progress ?? 0;
  md += `- **Estimate / Consumed / Left**: ${est}h / ${cons}h / ${left}h (${prog}%)\n`;
  
  if (rawTask.openedBy) md += `- **Opened By**: ${formatUser(rawTask.openedBy)}\n`;
  if (rawTask.assignedTo) md += `- **Assigned To**: ${formatUser(rawTask.assignedTo)}\n`;
  if (rawTask.finishedBy) md += `- **Finished By**: ${formatUser(rawTask.finishedBy)}\n`;
  if (rawTask.closedBy) {
    md += `- **Closed By**: ${formatUser(rawTask.closedBy)}`;
    if (rawTask.closedReason) md += ` (Reason: ${rawTask.closedReason})`;
    md += `\n`;
  }
  
  const descMarkdown = htmlToMarkdown(rawTask.desc);
  md += `\n## Description\n${descMarkdown || '*No description provided.*'}\n`;
  
  const files = parseFiles(rawTask.files);
  if (files && files.length > 0) {
    md += `\n## Attachments\n`;
    files.forEach((f: any) => {
      md += `- 📎 **${f.title}** (ID: ${f.id}, Extension: ${f.extension}, Size: ${formatSize(f.size)})\n`;
    });
  }
  return md;
}

export function bugToMarkdown(rawBug: any): string {
  if (!rawBug) return "Bug not found.";
  let md = `# Bug #${rawBug.id}: ${rawBug.title}\n\n`;
  md += `- **Status**: ${rawBug.status || 'N/A'}\n`;
  md += `- **Severity**: ${rawBug.severity || 'N/A'}\n`;
  md += `- **Priority**: ${rawBug.pri || 'N/A'}\n`;
  md += `- **Type**: ${rawBug.type || 'N/A'}\n`;
  
  if (rawBug.openedBy) md += `- **Opened By**: ${formatUser(rawBug.openedBy)}\n`;
  if (rawBug.assignedTo) md += `- **Assigned To**: ${formatUser(rawBug.assignedTo)}\n`;
  if (rawBug.resolvedBy) {
    md += `- **Resolved By**: ${formatUser(rawBug.resolvedBy)}`;
    if (rawBug.resolution) md += ` (Resolution: ${rawBug.resolution})`;
    md += `\n`;
  }
  if (rawBug.closedBy) md += `- **Closed By**: ${formatUser(rawBug.closedBy)}\n`;
  
  const stepsMarkdown = htmlToMarkdown(rawBug.steps);
  md += `\n## Steps to Reproduce\n${stepsMarkdown || '*No steps provided.*'}\n`;
  
  const files = parseFiles(rawBug.files);
  if (files && files.length > 0) {
    md += `\n## Attachments\n`;
    files.forEach((f: any) => {
      md += `- 📎 **${f.title}** (ID: ${f.id}, Extension: ${f.extension}, Size: ${formatSize(f.size)})\n`;
    });
  }
  return md;
}

export function registerTools(server: McpServer) {

  server.registerTool(
    "zentao_get_task_details",
    {
      description: "Get detailed information of a task",
      inputSchema: {
        taskId: z.union([z.string(), z.number()]).describe("Task ID"),
      }
    },
    async ({ taskId }) => {
      const data = await client.getTaskDetails(taskId);
      return {
        content: [{ type: "text", text: taskToMarkdown(data) }],
      };
    }
  );

  server.registerTool(
    "zentao_get_bug_details",
    {
      description: "Get detailed information of a bug",
      inputSchema: {
        bugId: z.union([z.string(), z.number()]).describe("Bug ID"),
      }
    },
    async ({ bugId }) => {
      const data = await client.getBugDetails(bugId);
      return {
        content: [{ type: "text", text: bugToMarkdown(data) }],
      };
    }
  );

  server.registerTool(
    "zentao_download_attachment",
    {
      description: "Download a file attachment from ZenTao and save it locally",
      inputSchema: {
        fileId: z.union([z.string(), z.number()]).describe("File ID to download"),
        extension: z.string().optional().describe("Optional file extension (e.g., mp4, png)"),
      }
    },
    async ({ fileId, extension }) => {
      const ext = extension ? (extension.startsWith('.') ? extension : `.${extension}`) : '';
      const targetPath = path.join(os.tmpdir(), `zentao_file_${fileId}${ext}`);
      try {
        // If it already exists on disk and is not currently being downloaded
        if (fs.existsSync(targetPath) && !activeDownloads.has(targetPath)) {
          return {
            content: [{ type: "text", text: `File already exists locally at: ${targetPath}` }],
          };
        }

        // If it is currently being downloaded, await the active promise
        if (activeDownloads.has(targetPath)) {
          await activeDownloads.get(targetPath);
          return {
            content: [{ type: "text", text: `File downloaded successfully to: ${targetPath}` }],
          };
        }

        // Start new download and track it
        const downloadPromise = client.downloadFile(fileId, targetPath);
        activeDownloads.set(targetPath, downloadPromise);

        try {
          const savedPath = await downloadPromise;
          return {
            content: [{ type: "text", text: `File downloaded successfully to: ${savedPath}` }],
          };
        } finally {
          activeDownloads.delete(targetPath);
        }
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Failed to download file: ${error.message}` }],
        };
      }
    }
  );
}

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

export function cleanTask(task: any) {
  if (!task) return null;
  return {
    id: task.id,
    name: task.name,
    status: task.status,
    pri: task.pri,
    desc: htmlToMarkdown(task.desc),
    estimate: task.estimate,
    consumed: task.consumed,
    left: task.left,
    progress: task.progress,
    openedBy: task.openedBy ? {
      account: task.openedBy.account,
      realname: task.openedBy.realname
    } : undefined,
    assignedTo: task.assignedTo ? {
      account: task.assignedTo.account,
      realname: task.assignedTo.realname
    } : undefined,
    finishedBy: task.finishedBy ? {
      account: task.finishedBy.account,
      realname: task.finishedBy.realname
    } : undefined,
    closedBy: task.closedBy ? {
      account: task.closedBy.account,
      realname: task.closedBy.realname
    } : undefined,
    closedReason: task.closedReason,
    files: parseFiles(task.files)
  };
}

export function cleanBug(bug: any) {
  if (!bug) return null;
  return {
    id: bug.id,
    title: bug.title,
    status: bug.status,
    severity: bug.severity,
    pri: bug.pri,
    type: bug.type,
    steps: htmlToMarkdown(bug.steps),
    openedBy: bug.openedBy ? {
      account: bug.openedBy.account,
      realname: bug.openedBy.realname
    } : undefined,
    assignedTo: bug.assignedTo ? {
      account: bug.assignedTo.account,
      realname: bug.assignedTo.realname
    } : undefined,
    resolvedBy: bug.resolvedBy ? {
      account: bug.resolvedBy.account,
      realname: bug.resolvedBy.realname
    } : undefined,
    resolution: bug.resolution,
    closedBy: bug.closedBy ? {
      account: bug.closedBy.account,
      realname: bug.closedBy.realname
    } : undefined,
    files: parseFiles(bug.files)
  };
}

export function formatSize(bytes: number | string | undefined | null): string {
  if (bytes === undefined || bytes === null || bytes === '') return 'unknown size';
  const numBytes = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(numBytes)) return 'unknown size';
  if (numBytes < 1024) return `${numBytes} B`;
  if (numBytes < 1024 * 1024) return `${(numBytes / 1024).toFixed(2)} KB`;
  return `${(numBytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function taskToMarkdown(rawTask: any): string {
  const task = cleanTask(rawTask);
  if (!task) return "Task not found.";
  let md = `# Task #${task.id}: ${task.name}\n\n`;
  md += `- **Status**: ${task.status || 'N/A'}\n`;
  md += `- **Priority**: ${task.pri || 'N/A'}\n`;
  
  const est = task.estimate ?? 0;
  const cons = task.consumed ?? 0;
  const left = task.left ?? 0;
  const prog = task.progress ?? 0;
  md += `- **Estimate / Consumed / Left**: ${est}h / ${cons}h / ${left}h (${prog}%)\n`;
  
  if (task.openedBy) md += `- **Opened By**: ${task.openedBy.realname} (${task.openedBy.account})\n`;
  if (task.assignedTo) md += `- **Assigned To**: ${task.assignedTo.realname} (${task.assignedTo.account})\n`;
  if (task.finishedBy) md += `- **Finished By**: ${task.finishedBy.realname} (${task.finishedBy.account})\n`;
  if (task.closedBy) {
    md += `- **Closed By**: ${task.closedBy.realname} (${task.closedBy.account})`;
    if (task.closedReason) md += ` (Reason: ${task.closedReason})`;
    md += `\n`;
  }
  
  md += `\n## Description\n${task.desc || '*No description provided.*'}\n`;
  
  if (task.files && task.files.length > 0) {
    md += `\n## Attachments\n`;
    task.files.forEach((f: any) => {
      md += `- 📎 **${f.title}** (ID: ${f.id}, Extension: ${f.extension}, Size: ${formatSize(f.size)})\n`;
    });
  }
  return md;
}

export function bugToMarkdown(rawBug: any): string {
  const bug = cleanBug(rawBug);
  if (!bug) return "Bug not found.";
  let md = `# Bug #${bug.id}: ${bug.title}\n\n`;
  md += `- **Status**: ${bug.status || 'N/A'}\n`;
  md += `- **Severity**: ${bug.severity || 'N/A'}\n`;
  md += `- **Priority**: ${bug.pri || 'N/A'}\n`;
  md += `- **Type**: ${bug.type || 'N/A'}\n`;
  
  if (bug.openedBy) md += `- **Opened By**: ${bug.openedBy.realname} (${bug.openedBy.account})\n`;
  if (bug.assignedTo) md += `- **Assigned To**: ${bug.assignedTo.realname} (${bug.assignedTo.account})\n`;
  if (bug.resolvedBy) {
    md += `- **Resolved By**: ${bug.resolvedBy.realname} (${bug.resolvedBy.account})`;
    if (bug.resolution) md += ` (Resolution: ${bug.resolution})`;
    md += `\n`;
  }
  if (bug.closedBy) md += `- **Closed By**: ${bug.closedBy.realname} (${bug.closedBy.account})\n`;
  
  md += `\n## Steps to Reproduce\n${bug.steps || '*No steps provided.*'}\n`;
  
  if (bug.files && bug.files.length > 0) {
    md += `\n## Attachments\n`;
    bug.files.forEach((f: any) => {
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

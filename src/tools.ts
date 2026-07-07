import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as os from "os";
import * as path from "path";
import { ZentaoClient } from "./zentaoClient.js";

const client = new ZentaoClient();

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

function cleanTask(task: any) {
  if (!task) return null;
  return {
    id: task.id,
    name: task.name,
    status: task.status,
    pri: task.pri,
    desc: task.desc,
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

function cleanBug(bug: any) {
  if (!bug) return null;
  return {
    id: bug.id,
    title: bug.title,
    status: bug.status,
    severity: bug.severity,
    pri: bug.pri,
    type: bug.type,
    steps: bug.steps,
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
      const cleaned = cleanTask(data);
      return {
        content: [{ type: "text", text: JSON.stringify(cleaned, null, 2) }],
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
      const cleaned = cleanBug(data);
      return {
        content: [{ type: "text", text: JSON.stringify(cleaned, null, 2) }],
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
        const savedPath = await client.downloadFile(fileId, targetPath);
        return {
          content: [{ type: "text", text: `File downloaded successfully to: ${savedPath}` }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Failed to download file: ${error.message}` }],
        };
      }
    }
  );
}

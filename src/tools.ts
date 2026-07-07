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
 * - `zentao_get_execution_tasks`: Fetch all tasks within a sprint/execution.
 * - `zentao_get_task_details`: Fetch full details of a specific task by ID.
 * - `zentao_get_product_bugs`: Fetch all bugs reported for a product.
 * - `zentao_get_bug_details`: Fetch full details of a specific bug by ID.
 * - `zentao_download_attachment`: Download attachments (e.g. bug reproduction videos/images) and save locally.
 * 
 * @param server The MCP Server instance where the tools will be registered.
 */
export function registerTools(server: McpServer) {
  server.registerTool(
    "zentao_get_execution_tasks",
    {
      description: "Get a list of tasks in an execution (sprint), optionally filtered by moduleID",
      inputSchema: {
        executionId: z.union([z.string(), z.number()]).describe("Execution ID"),
        page: z.number().optional().describe("Current page (default 1)"),
        limit: z.number().optional().describe("Number of items per page (default 500)"),
        moduleId: z.union([z.string(), z.number()]).optional().describe("Filter by module ID"),
      }
    },
    async ({ executionId, page = 1, limit = 500, moduleId }) => {
      const data = await client.getExecutionTasks(executionId, page, limit, moduleId);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

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
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.registerTool(
    "zentao_get_product_bugs",
    {
      description: "Get a list of bugs for a product",
      inputSchema: {
        productId: z.union([z.string(), z.number()]).describe("Product ID"),
      }
    },
    async ({ productId }) => {
      const data = await client.getProductBugs(productId);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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

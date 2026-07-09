import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as os from "os";
import * as path from "path";
import fs from "fs";
import { ZentaoClient } from "../zentaoClient.js";
import { mcpText } from "../utils/mcpResponse.js";

/** Tracks in-flight downloads to deduplicate concurrent requests for the same file. */
const activeDownloads = new Map<string, Promise<string>>();

/**
 * Download a ZenTao attachment to a local path.
 * Deduplicates concurrent requests for the same target file.
 */
async function downloadAttachment(
  client: ZentaoClient,
  fileId: string | number,
  targetPath: string
): Promise<string> {
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

/**
 * Register the `zentao_download_attachment` MCP tool on the given server.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used for downloading files.
 */
export function registerDownloadTool(server: McpServer, client: ZentaoClient): void {
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
      const ext = extension
        ? extension.startsWith('.') ? extension : `.${extension}`
        : '';
      const targetPath = path.join(os.tmpdir(), `zentao_file_${fileId}${ext}`);
      try {
        const message = await downloadAttachment(client, fileId, targetPath);
        return mcpText(message);
      } catch (error: any) {
        return mcpText(`Failed to download file: ${error.message}`);
      }
    }
  );
}

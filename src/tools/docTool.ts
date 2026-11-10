import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZentaoClient } from "../zentaoClient.js";
import { docToMarkdown } from "../formatters/docFormatter.js";
import { buildMcpResponse, mcpText } from "../utils/mcpResponse.js";

/** Accept a bare ID or a doc page link such as `.../zentao/doc-view-96.html`. */
export function parseDocId(input: string | number): string | null {
  const text = String(input).trim();
  if (/^\d+$/.test(text)) return text;
  const match = text.match(/doc-view-(\d+)/) || text.match(/[?&]docID=(\d+)/i);
  return match ? match[1] : null;
}

/**
 * Register the `zentao_get_doc` MCP tool on the given server.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to fetch and process data.
 */
export function registerDocTool(server: McpServer, client: ZentaoClient): void {
  server.registerTool(
    "zentao_get_doc",
    {
      description: "Read a document from the ZenTao doc library (title, metadata, content as Markdown, attachments)",
      inputSchema: {
        doc: z.union([z.string(), z.number()]).describe("Doc ID, or a doc link such as https://.../zentao/doc-view-96.html"),
      },
    },
    async ({ doc }) => {
      const docId = parseDocId(doc);
      if (!docId) {
        return mcpText(`Could not find a doc ID in "${doc}". Pass a numeric ID or a doc-view link.`);
      }

      const downloadedImages: string[] = [];
      const markdown = await docToMarkdown(await client.getDocDetails(docId), client, downloadedImages);
      return await buildMcpResponse(markdown, downloadedImages);
    }
  );
}

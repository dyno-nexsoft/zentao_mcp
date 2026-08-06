import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ZentaoClient } from "../zentaoClient.js";
import { bugToMarkdown } from "../formatters/bugFormatter.js";
import { buildMcpResponse } from "../utils/mcpResponse.js";

/**
 * Re-fetch a bug's full detail after a write so the response includes the
 * complete, freshly-persisted view (title, steps, history, comments). Falls
 * back to the raw write response if the ID is missing or the fetch fails.
 */
async function formatWrittenBug(
  client: ZentaoClient,
  written: any,
  successHeading: string
) {
  const bugId = written?.id ?? written?.bug?.id;
  let data = written;
  if (bugId) {
    try {
      data = await client.getBugDetails(bugId);
    } catch {
      // Fall back to the write response if the detail fetch fails.
    }
  }

  const downloadedImages: string[] = [];
  const markdown = await bugToMarkdown(data, client, downloadedImages);
  return await buildMcpResponse(`### ${successHeading}\n\n${markdown}`, downloadedImages);
}

/**
 * Register the bug create/edit MCP tools on the given server.
 *
 * @param server The MCP Server instance.
 * @param client Authenticated ZentaoClient used to create/update data.
 */
export function registerBugTools(server: McpServer, client: ZentaoClient): void {
  // ─── Create Bug Tool ───────────────────────────────────────────────────────
  server.registerTool(
    "zentao_create_bug",
    {
      description: "Create a new bug under a product",
      inputSchema: {
        productId: z.union([z.string(), z.number()]).describe("Product ID the bug belongs to"),
        title: z.string().describe("Bug title"),
        type: z.string().optional().describe("Bug type (e.g. codeerror, designchange, configerror, installedefect)"),
        severity: z.number().optional().describe("Severity (1=highest .. 4=lowest)"),
        pri: z.number().optional().describe("Priority (1=highest .. 4=lowest)"),
        steps: z.string().optional().describe("Bug reproduction steps (plain text or HTML)"),
        assignedTo: z.string().optional().describe("User account to assign the bug to"),
        module: z.union([z.string(), z.number()]).optional().describe("Module ID"),
        openedBuild: z.string().optional().describe("Build/version where the bug was found"),
      },
    },
    async ({ productId, title, type, severity, pri, steps, assignedTo, module, openedBuild }) => {
      const payload: any = { title };
      if (type !== undefined) payload.type = type;
      if (severity !== undefined) payload.severity = severity;
      if (pri !== undefined) payload.pri = pri;
      if (steps !== undefined) payload.steps = steps;
      if (assignedTo !== undefined) payload.assignedTo = assignedTo;
      if (module !== undefined) payload.module = module;
      if (openedBuild !== undefined) payload.openedBuild = openedBuild;

      const created = await client.createBug(productId, payload);
      return await formatWrittenBug(client, created, "Successfully created bug!");
    }
  );

  // ─── Edit Bug Tool ─────────────────────────────────────────────────────────
  server.registerTool(
    "zentao_edit_bug",
    {
      description: "Edit an existing bug's fields (only the fields you provide are changed)",
      inputSchema: {
        bugId: z.union([z.string(), z.number()]).describe("Bug ID to edit"),
        title: z.string().optional().describe("New bug title"),
        type: z.string().optional().describe("Bug type (e.g. code, design, feature, configerror, security)"),
        severity: z.number().optional().describe("Severity (1=highest .. 4=lowest)"),
        pri: z.number().optional().describe("Priority (1=highest .. 4=lowest)"),
        steps: z.string().optional().describe("New bug reproduction steps (plain text or HTML)"),
        assignedTo: z.string().optional().describe("User account to reassign the bug to"),
        module: z.union([z.string(), z.number()]).optional().describe("Module ID"),
      },
    },
    async ({ bugId, title, type, severity, pri, steps, assignedTo, module }) => {
      const payload: any = {};
      if (title !== undefined) payload.title = title;
      if (type !== undefined) payload.type = type;
      if (severity !== undefined) payload.severity = severity;
      if (pri !== undefined) payload.pri = pri;
      if (steps !== undefined) payload.steps = steps;
      if (assignedTo !== undefined) payload.assignedTo = assignedTo;
      if (module !== undefined) payload.module = module;

      await client.updateBug(bugId, payload);
      // The PUT response can be terse; re-fetch by the known ID for a full view.
      return await formatWrittenBug(client, { id: bugId }, "Successfully updated bug!");
    }
  );
}
import { ZentaoClient } from "../zentaoClient.js";
import { htmlToMarkdown, parseFiles, formatUser } from "../utils/markdownUtils.js";
import { localizeImages } from "./imageLocalizer.js";
import { renderAttachments } from "./attachmentRenderer.js";

/**
 * Format a raw ZenTao bug object into a human-readable Markdown document.
 *
 * @param rawBug           The raw bug object returned by the Zentao API.
 * @param client           Authenticated ZentaoClient used for image/attachment downloads.
 * @param downloadedImages Optional collector for locally saved image paths
 *                         (used by the MCP response builder to embed images).
 */
export async function bugToMarkdown(
  rawBug: any,
  client: ZentaoClient,
  downloadedImages?: string[]
): Promise<string> {
  if (!rawBug) return "Bug not found.";

  // ── Compact metadata row ──
  const meta: string[] = [
    `**Status:** ${rawBug.status || 'N/A'}`,
    `**Severity:** ${rawBug.severity || 'N/A'}`,
    `**Priority:** ${rawBug.pri || 'N/A'}`,
    `**Type:** ${rawBug.type || 'N/A'}`,
  ];

  if (rawBug.openedBy)   meta.push(`**Opened by:** ${formatUser(rawBug.openedBy)}`);
  if (rawBug.assignedTo) meta.push(`**Assigned to:** ${formatUser(rawBug.assignedTo)}`);
  if (rawBug.resolvedBy) {
    const resolution = rawBug.resolution ? ` (${rawBug.resolution})` : '';
    meta.push(`**Resolved by:** ${formatUser(rawBug.resolvedBy)}${resolution}`);
  }
  if (rawBug.closedBy)   meta.push(`**Closed by:** ${formatUser(rawBug.closedBy)}`);

  const localizedSteps = await localizeImages(rawBug.steps, client, downloadedImages);
  const steps           = htmlToMarkdown(localizedSteps);
  const attachments     = await renderAttachments(parseFiles(rawBug.files), client, downloadedImages);

  return [
    `# Bug #${rawBug.id}: ${rawBug.title}`,
    '',
    ...meta.map((m) => `- ${m}`),
    '',
    '## Repro Steps',
    steps || '*No steps provided.*',
    attachments,
  ].join('\n');
}

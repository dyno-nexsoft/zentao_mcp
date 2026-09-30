import { ZentaoClient } from "../zentaoClient.js";
import { htmlToMarkdown, parseFiles, formatUser } from "../utils/markdownUtils.js";
import { localizeImages } from "./imageLocalizer.js";
import { renderAttachments } from "./attachmentRenderer.js";
import { renderHistoryAndComments } from "./actionFormatter.js";

/**
 * Format a raw ZenTao task object into a human-readable Markdown document.
 *
 * @param rawTask          The raw task object returned by the Zentao API.
 * @param client           Authenticated ZentaoClient used for image/attachment downloads.
 * @param downloadedImages Optional collector for locally saved image paths
 *                         (used by the MCP response builder to embed images).
 */
export async function taskToMarkdown(
  rawTask: any,
  client: ZentaoClient,
  downloadedImages?: string[]
): Promise<string> {
  if (!rawTask) return "Task not found.";

  const est  = rawTask.estimate  ?? 0;
  const cons = rawTask.consumed  ?? 0;
  const left = rawTask.left      ?? 0;
  const prog = rawTask.progress  ?? 0;

  // ── Compact metadata row ──
  const meta: string[] = [
    `**Status:** ${rawTask.status || 'N/A'}`,
    `**Priority:** ${rawTask.pri || 'N/A'}`,
    `**Estimate/Consumed/Left:** ${est}h / ${cons}h / ${left}h (${prog}%)`,
  ];

  if (Number(rawTask.parent) > 0) meta.push(`**Parent task:** #${rawTask.parent}`);
  if (rawTask.openedBy)   meta.push(`**Opened by:** ${formatUser(rawTask.openedBy)}`);
  if (rawTask.assignedTo) meta.push(`**Assigned to:** ${formatUser(rawTask.assignedTo)}`);
  if (rawTask.finishedBy) meta.push(`**Finished by:** ${formatUser(rawTask.finishedBy)}`);
  if (rawTask.closedBy) {
    const reason = rawTask.closedReason ? ` (${rawTask.closedReason})` : '';
    meta.push(`**Closed by:** ${formatUser(rawTask.closedBy)}${reason}`);
  }

  const localizedDesc = await localizeImages(rawTask.desc, client, downloadedImages);
  const desc           = htmlToMarkdown(localizedDesc);
  const attachments    = await renderAttachments(parseFiles(rawTask.files), client, downloadedImages);
  const historySection = await renderHistoryAndComments(rawTask.actions, client, downloadedImages);

  const parts = [
    `# Task #${rawTask.id}: ${rawTask.name}`,
    '',
    ...meta.map((m) => `- ${m}`),
    '',
    '## Description',
    desc || '*No description provided.*',
  ];

  if (attachments) {
    parts.push(attachments);
  }
  if (historySection) {
    parts.push(historySection);
  }

  return parts.join('\n');
}

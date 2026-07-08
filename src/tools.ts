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

/** Convert a local absolute path to a valid file:// URL. */
function toFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }
  if (normalized.startsWith('/')) {
    return `file://${normalized}`;
  }
  return `file:///${normalized}`;
}

/**
 * Find all <img src="..."> tags in an HTML string, download each image
 * to the local tmp directory using the authenticated ZenTao client,
 * and replace the entire <img> tag with an <a> link pointing to the local file:// URL.
 * This saves AI tokens (no huge Base64 data) and avoids local file load errors in UI.
 */
async function localizeImages(html: string): Promise<string> {
  if (!html) return html;
  const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const matches = [...html.matchAll(imgTagRegex)];
  if (matches.length === 0) return html;

  let result = html;
  await Promise.all(matches.map(async (match) => {
    const fullTag = match[0];
    const remoteUrl = match[1];

    const altMatch = fullTag.match(/alt=["']([^"']+)["']/i);
    const filename = path.basename(remoteUrl.split('?')[0]);
    const linkText = altMatch ? altMatch[1] : filename;

    const localFilename = `zentao_img_${filename}`;
    const localPath = path.join(os.tmpdir(), localFilename);
    try {
      if (!fs.existsSync(localPath)) {
        await client.downloadImageToLocal(remoteUrl, localPath);
      }
      const fileUrl = toFileUrl(localPath);
      // Replace img tag with a standard hyperlink (no inline rendering, saves tokens)
      const linkTag = `<a href="${fileUrl}">📎 ${linkText}</a>`;
      result = result.split(fullTag).join(linkTag);
    } catch {
      // Keep original tag if download fails
    }
  }));
  return result;
}

/** Format a file size in bytes to a human-readable string (B / KB / MB). */
function formatSize(bytes: number | string | undefined | null): string {
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

/** Download all attachments to local tmp dir and render them as a Markdown section with AI hints. */
async function renderAttachments(files: { id: any; title: string; extension: string; size: any }[]): Promise<string> {
  if (!files || files.length === 0) return '';

  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);
  const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm']);

  type EnrichedFile = { title: string; size: any; localPath: string | null; ext: string };

  const enriched: EnrichedFile[] = await Promise.all(files.map(async (f) => {
    const ext = (f.extension || '').toLowerCase();
    const targetPath = path.join(os.tmpdir(), `zentao_file_${f.id}.${ext}`);
    let localPath: string | null = null;
    try {
      localPath = fs.existsSync(targetPath)
        ? targetPath
        : await client.downloadFile(f.id, targetPath);
    } catch { /* keep null, show download failed below */ }
    return { title: f.title, size: f.size, localPath, ext };
  }));

  // Build section header hint based on media types present
  const hasImage = enriched.some(f => f.localPath && IMAGE_EXTS.has(f.ext));
  const hasVideo = enriched.some(f => f.localPath && VIDEO_EXTS.has(f.ext));
  let headerHint = '';
  if (hasImage && hasVideo) headerHint = ' *(AI: Please view the images and videos below)*';
  else if (hasImage)        headerHint = ' *(AI: Please view the images below)*';
  else if (hasVideo)        headerHint = ' *(AI: Please view the videos below)*';

  const lines = enriched.map((f) => {
    if (!f.localPath) return `- 📎 ${f.title} — *(download failed, Size: ${formatSize(f.size)})*`;
    const fileUrl = toFileUrl(f.localPath);
    return `- 📎 [${f.title}](${fileUrl}) *(Size: ${formatSize(f.size)})*`;
  });

  return `\n## Files 📎${headerHint}\n${lines.join('\n')}\n`;
}

// ─── Public formatters ───────────────────────────────────────────────────────

/**
 * Format a raw ZenTao task object into a human-readable Markdown document.
 */
export async function taskToMarkdown(rawTask: any): Promise<string> {
  if (!rawTask) return "Task not found.";

  const est  = rawTask.estimate ?? 0;
  const cons = rawTask.consumed ?? 0;
  const left = rawTask.left ?? 0;
  const prog = rawTask.progress ?? 0;

  // ── Compact metadata row ──
  const meta: string[] = [
    `**Status:** ${rawTask.status || 'N/A'}`,
    `**Priority:** ${rawTask.pri || 'N/A'}`,
    `**Estimate/Consumed/Left:** ${est}h / ${cons}h / ${left}h (${prog}%)`,
  ];
  if (rawTask.openedBy)   meta.push(`**Opened by:** ${formatUser(rawTask.openedBy)}`);
  if (rawTask.assignedTo) meta.push(`**Assigned to:** ${formatUser(rawTask.assignedTo)}`);
  if (rawTask.finishedBy) meta.push(`**Finished by:** ${formatUser(rawTask.finishedBy)}`);
  if (rawTask.closedBy) {
    const reason = rawTask.closedReason ? ` (${rawTask.closedReason})` : '';
    meta.push(`**Closed by:** ${formatUser(rawTask.closedBy)}${reason}`);
  }

  const localizedDesc = await localizeImages(rawTask.desc);
  const desc = htmlToMarkdown(localizedDesc);
  const attachments = await renderAttachments(parseFiles(rawTask.files));

  const metaList = meta.map(m => `- ${m}`).join('\n');

  return [
    `# Task #${rawTask.id}: ${rawTask.name}`,
    '',
    metaList,
    '',
    '## Description',
    desc || '*No description provided.*',
    attachments,
  ].join('\n');
}

/**
 * Format a raw ZenTao bug object into a human-readable Markdown document.
 */
export async function bugToMarkdown(rawBug: any): Promise<string> {
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
  if (rawBug.closedBy) meta.push(`**Closed by:** ${formatUser(rawBug.closedBy)}`);

  const localizedSteps = await localizeImages(rawBug.steps);
  const steps = htmlToMarkdown(localizedSteps);
  const attachments = await renderAttachments(parseFiles(rawBug.files));

  const metaList = meta.map(m => `- ${m}`).join('\n');

  return [
    `# Bug #${rawBug.id}: ${rawBug.title}`,
    '',
    metaList,
    '',
    '## Repro Steps',
    steps || '*No steps provided.*',
    attachments,
  ].join('\n');
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
      return mcpText(await taskToMarkdown(data));
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
      return mcpText(await bugToMarkdown(data));
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

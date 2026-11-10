import { ZentaoClient } from "../zentaoClient.js";
import { htmlToMarkdown, parseFiles, formatUser } from "../utils/markdownUtils.js";
import { localizeImages } from "./imageLocalizer.js";
import { renderAttachments } from "./attachmentRenderer.js";

/**
 * Doc images are stored with server-relative paths (e.g. `/zentao/file-read-1.png`),
 * which the image downloader cannot fetch, so anchor them to the server origin.
 */
function absolutizeImageSources(html: string, webUrl: string): string {
  let origin: string;
  try {
    origin = new URL(webUrl).origin;
  } catch {
    return html;
  }
  return html.replace(/(<img[^>]+src=["'])(\/(?!\/))/gi, `$1${origin}$2`);
}

/**
 * Format a raw ZenTao document into a human-readable Markdown document.
 *
 * @param rawDoc           The raw doc object returned by `GET /docs/{id}`.
 * @param client           Authenticated ZentaoClient used for image/attachment downloads.
 * @param downloadedImages Optional collector for locally saved image paths
 *                         (used by the MCP response builder to embed images).
 */
export async function docToMarkdown(
  rawDoc: any,
  client: ZentaoClient,
  downloadedImages?: string[]
): Promise<string> {
  if (!rawDoc || !rawDoc.id) return "Doc not found.";

  const meta: string[] = [];
  if (rawDoc.libName)  meta.push(`**Library:** ${rawDoc.libName}`);
  if (rawDoc.moduleName) meta.push(`**Module:** ${rawDoc.moduleName}`);
  if (rawDoc.version)  meta.push(`**Version:** ${rawDoc.version}`);
  if (rawDoc.addedBy)  meta.push(`**Added by:** ${formatUser(rawDoc.addedBy)} on ${rawDoc.addedDate || 'N/A'}`);
  if (rawDoc.editedBy) meta.push(`**Edited by:** ${formatUser(rawDoc.editedBy)} on ${rawDoc.editedDate || 'N/A'}`);
  if (rawDoc.keywords) meta.push(`**Keywords:** ${rawDoc.keywords}`);
  meta.push(`**Link:** ${client.webUrl}/doc-view-${rawDoc.id}.html`);

  let body: string;
  if (rawDoc.type === 'url') {
    body = rawDoc.content ? `External link: ${rawDoc.content}` : '';
  } else if (rawDoc.contentType === 'markdown') {
    body = rawDoc.content || '';
  } else {
    const html = absolutizeImageSources(rawDoc.content || '', client.webUrl);
    body = htmlToMarkdown(await localizeImages(html, client, downloadedImages));
  }

  const attachments = await renderAttachments(parseFiles(rawDoc.files), client, downloadedImages);

  const parts = [
    `# Doc #${rawDoc.id}: ${rawDoc.title}`,
    '',
    ...meta.map((m) => `- ${m}`),
    '',
    '## Content',
    body || '*No content.*',
  ];

  if (attachments) {
    parts.push(attachments);
  }

  return parts.join('\n');
}

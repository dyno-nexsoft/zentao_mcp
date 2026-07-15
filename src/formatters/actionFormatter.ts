import { ZentaoClient } from "../zentaoClient.js";
import { htmlToMarkdown, parseFiles } from "../utils/markdownUtils.js";
import { localizeImages } from "./imageLocalizer.js";
import { toFileUrl, formatSize } from "../utils/fileUtils.js";
import * as path from "path";
import * as os from "os";
import fs from "fs";

/**
 * Normalizes and formats the history/comments/actions list into a clean Markdown block.
 *
 * @param actions          The raw actions array from Zentao task or bug response.
 * @param client           Authenticated ZentaoClient used for image/attachment downloads.
 * @param downloadedImages Optional collector for local image paths.
 */
export async function renderHistoryAndComments(
  actions: any[] | undefined | null,
  client: ZentaoClient,
  downloadedImages?: string[]
): Promise<string> {
  if (!actions || !Array.isArray(actions) || actions.length === 0) {
    return "";
  }

  const lines: string[] = [];

  for (const act of actions) {
    // 1. Localize and convert the action description (desc)
    let desc = "";
    if (act.desc) {
      const localizedDesc = await localizeImages(act.desc, client, downloadedImages);
      desc = htmlToMarkdown(localizedDesc).trim();
      // Remove date prefix from desc if it exists to avoid redundancy
      if (act.date) {
        const prefixes = [act.date + ",", act.date + " "];
        for (const prefix of prefixes) {
          if (desc.startsWith(prefix)) {
            desc = desc.substring(prefix.length).trim();
            break;
          }
        }
      }
    }

    // Fallback if description is empty
    if (!desc) {
      desc = `${act.actor || "User"} did action "${act.action || "unknown"}"`;
    }

    // 2. Format comment if present
    let commentStr = "";
    if (act.comment) {
      const localizedComment = await localizeImages(act.comment, client, downloadedImages);
      const commentMd = htmlToMarkdown(localizedComment).trim();
      if (commentMd) {
        // Blockquote the comment
        commentStr = `\n  > ${commentMd.replace(/\n/g, '\n  > ')}`;
      }
    }

    // 3. Format files if present in action
    let filesStr = "";
    if (act.files) {
      const parsedFiles = parseFiles(act.files);
      if (parsedFiles.length > 0) {
        const fileLinks: string[] = [];
        for (const f of parsedFiles) {
          const ext = (f.extension || '').toLowerCase();
          const targetPath = path.join(os.tmpdir(), `zentao_file_${f.id}.${ext}`);
          let localPath: string | null = null;
          try {
            localPath = fs.existsSync(targetPath)
              ? targetPath
              : await client.downloadFile(f.id, targetPath);

            if (localPath && downloadedImages && !downloadedImages.includes(localPath)) {
              downloadedImages.push(localPath);
            }
          } catch {
            // ignore download error
          }
          if (localPath) {
            fileLinks.push(`[${f.title}](${toFileUrl(localPath)}) *(Size: ${formatSize(f.size)})*`);
          } else {
            fileLinks.push(`[${f.title}] *(download failed)*`);
          }
        }
        if (fileLinks.length > 0) {
          filesStr = `\n  - *Attachments:* ${fileLinks.join(", ")}`;
        }
      }
    }

    // 4. Combine into a timeline item
    lines.push(`- **[${act.date || "N/A"}]** ${desc}${commentStr}${filesStr}`);
  }

  if (lines.length === 0) return "";

  return [
    "",
    "## History & Comments",
    "",
    ...lines,
  ].join("\n");
}

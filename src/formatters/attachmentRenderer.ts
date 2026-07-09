import * as os from "os";
import * as path from "path";
import fs from "fs";
import { ZentaoClient } from "../zentaoClient.js";
import { toFileUrl, getMimeType, formatSize } from "../utils/fileUtils.js";

/** A normalised ZenTao file descriptor used by the renderer. */
export interface ZentaoFile {
  id: any;
  title: string;
  extension: string;
  size: any;
}

/**
 * Download all attachments in `files` to the local tmp directory and
 * render them as a Markdown `## Files` section.
 *
 * @param files            Array of normalised file descriptors.
 * @param client           Authenticated ZentaoClient used for downloads.
 * @param downloadedImages Optional collector – successfully downloaded image
 *                         paths are pushed here for later MCP embedding.
 * @returns A Markdown string starting with `\n## Files\n`, or `''` when
 *          there are no files.
 */
export async function renderAttachments(
  files: ZentaoFile[],
  client: ZentaoClient,
  downloadedImages?: string[]
): Promise<string> {
  if (!files || files.length === 0) return '';

  type EnrichedFile = {
    title: string;
    size: any;
    localPath: string | null;
    ext: string;
  };

  const enriched: EnrichedFile[] = await Promise.all(
    files.map(async (f) => {
      const ext = (f.extension || '').toLowerCase();
      const targetPath = path.join(os.tmpdir(), `zentao_file_${f.id}.${ext}`);
      let localPath: string | null = null;

      try {
        localPath = fs.existsSync(targetPath)
          ? targetPath
          : await client.downloadFile(f.id, targetPath);

        // Fix #5: only push each path once to avoid duplicates in the MCP response.
        if (localPath && downloadedImages && getMimeType(targetPath) && !downloadedImages.includes(localPath)) {
          downloadedImages.push(localPath);
        }
      } catch {
        /* keep null — shown as download-failed below */
      }

      return { title: f.title, size: f.size, localPath, ext };
    })
  );

  const lines = enriched.map((f) => {
    if (!f.localPath) {
      return `- ${f.title} — *(download failed, Size: ${formatSize(f.size)})*`;
    }
    const fileUrl = toFileUrl(f.localPath);
    return `- [${f.title}](${fileUrl}) *(Size: ${formatSize(f.size)})*`;
  });

  return `\n## Files\n${lines.join('\n')}\n`;
}

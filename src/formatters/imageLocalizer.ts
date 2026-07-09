import * as os from "os";
import * as path from "path";
import fs from "fs";
import { ZentaoClient } from "../zentaoClient.js";
import { toFileUrl, getMimeType } from "../utils/fileUtils.js";

/**
 * Find all <img src="..."> tags in an HTML string, download each image
 * to the local tmp directory using the authenticated ZenTao client,
 * and replace the entire <img> tag with an <a> link pointing to the
 * local file:// URL.
 *
 * This keeps AI tokens low (no huge Base64 blobs) and avoids local-file
 * load errors in some UI environments.
 *
 * @param html            The raw HTML string to process.
 * @param client          Authenticated ZentaoClient used for downloads.
 * @param downloadedImages Optional collector – successfully downloaded
 *                         local paths are pushed here for later rendering.
 */
export async function localizeImages(
  html: string,
  client: ZentaoClient,
  downloadedImages?: string[]
): Promise<string> {
  if (!html) return html;

  const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const matches = [...html.matchAll(imgTagRegex)];
  if (matches.length === 0) return html;

  let result = html;

  await Promise.all(
    matches.map(async (match) => {
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
        if (downloadedImages && getMimeType(localPath)) {
          downloadedImages.push(localPath);
        }
        const fileUrl = toFileUrl(localPath);
        // Replace img tag with a standard hyperlink (no inline rendering)
        const linkTag = `<a href="${fileUrl}">${linkText}</a>`;
        result = result.split(fullTag).join(linkTag);
      } catch {
        // Keep original tag if download fails
      }
    })
  );

  return result;
}

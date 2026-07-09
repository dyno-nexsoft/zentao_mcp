import * as os from "os";
import * as path from "path";
import fs from "fs";
import { ZentaoClient } from "../zentaoClient.js";
import { toFileUrl, getMimeType } from "../utils/fileUtils.js";

/**
 * In-flight download deduplication map.
 * Key: remote URL → Value: Promise resolving to local file path.
 *
 * Prevents concurrent coroutines from downloading the same image
 * simultaneously when the same URL appears multiple times in the HTML.
 */
const inFlightImageDownloads = new Map<string, Promise<string>>();

/**
 * Find all <img src="..."> tags in an HTML string, download each image
 * to the local tmp directory using the authenticated ZenTao client,
 * and replace the entire <img> tag with an <a> link pointing to the
 * local file:// URL.
 *
 * Guarantees:
 * - Each unique URL is downloaded **at most once** even when called concurrently.
 * - The `result` string is mutated **only after** all downloads finish,
 *   eliminating the race condition from parallel `Promise.all` writes.
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

  // Phase 1: Download all images in parallel (deduplicated per URL).
  // Collect replacements as a Map<fullTag, linkTag> — applied in phase 2.
  const replacements = new Map<string, string>();

  await Promise.all(
    matches.map(async (match) => {
      const fullTag = match[0];
      const remoteUrl = match[1];

      const altMatch = fullTag.match(/alt=["']([^"']+)["']/i);
      const filename = path.basename(remoteUrl.split("?")[0]);
      const linkText = altMatch ? altMatch[1] : filename;

      const localFilename = `zentao_img_${filename}`;
      const localPath = path.join(os.tmpdir(), localFilename);

      try {
        // Deduplicate: reuse an in-flight promise for the same URL.
        if (!inFlightImageDownloads.has(remoteUrl)) {
          if (fs.existsSync(localPath)) {
            // Already cached on disk — resolve immediately.
            inFlightImageDownloads.set(remoteUrl, Promise.resolve(localPath));
          } else {
            const dlPromise = client
              .downloadImageToLocal(remoteUrl, localPath)
              .finally(() => inFlightImageDownloads.delete(remoteUrl));
            inFlightImageDownloads.set(remoteUrl, dlPromise);
          }
        }

        await inFlightImageDownloads.get(remoteUrl);

        // Only push each local path once to avoid duplicates.
        if (
          downloadedImages &&
          getMimeType(localPath) &&
          !downloadedImages.includes(localPath)
        ) {
          downloadedImages.push(localPath);
        }

        const fileUrl = toFileUrl(localPath);
        const linkTag = `<a href="${fileUrl}">${linkText}</a>`;
        replacements.set(fullTag, linkTag);
      } catch {
        // Keep original tag if download fails.
      }
    })
  );

  // Phase 2: Apply all replacements sequentially on the original string.
  // This is safe because we only write `result` after all awaits complete.
  let result = html;
  for (const [original, replacement] of replacements) {
    // Use split/join for literal string replacement (no regex special chars risk).
    result = result.split(original).join(replacement);
  }

  return result;
}

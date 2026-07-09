import * as path from "path";

const KB = 1024;
const MB = 1024 * KB;

/**
 * Convert a local absolute path to a valid file:// URL.
 * Handles Windows drive-letter paths (e.g. C:/...) and Unix-style paths.
 */
export function toFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }
  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }
  return `file:///${normalized}`;
}

/**
 * Determine the MIME type of a file based on its extension.
 * Returns `null` for unrecognised or non-image extensions.
 */
export function getMimeType(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":  return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif":  return "image/gif";
    case ".webp": return "image/webp";
    case ".bmp":  return "image/bmp";
    case ".svg":  return "image/svg+xml";
    default:      return null;
  }
}

/**
 * Format a file size (bytes) to a human-readable string (B / KB / MB).
 */
export function formatSize(bytes: number | string | undefined | null): string {
  if (bytes === undefined || bytes === null || bytes === "") return "unknown size";
  const numBytes = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (isNaN(numBytes)) return "unknown size";
  if (numBytes < KB) return `${numBytes} B`;
  if (numBytes < MB) return `${(numBytes / KB).toFixed(2)} KB`;
  return `${(numBytes / MB).toFixed(2)} MB`;
}

import fs from "fs";
import { getMimeType } from "./fileUtils.js";

/** Build a standard MCP text-only content response. */
export function mcpText(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/**
 * Build an MCP response containing a Markdown text block followed by
 * inline base64 image blocks for each discovered local image path.
 *
 * Images are deduplicated and limited to the first 5 to stay within
 * JSON-RPC / token limits. Individual images larger than 2 MB are skipped.
 */
export function buildMcpResponse(markdown: string, imagePaths: string[]) {
  const content: any[] = [{ type: "text", text: markdown }];

  // Deduplicate and cap at 5 images
  const uniquePaths = Array.from(new Set(imagePaths)).slice(0, 5);

  for (const imgPath of uniquePaths) {
    try {
      if (!fs.existsSync(imgPath)) continue;
      const mimeType = getMimeType(imgPath);
      if (!mimeType) continue;
      const stats = fs.statSync(imgPath);
      // Skip images > 2 MB to avoid hitting JSON-RPC / token limits
      if (stats.size > 2 * 1024 * 1024) continue;
      const data = fs.readFileSync(imgPath).toString("base64");
      content.push({ type: "image", data, mimeType });
    } catch {
      // Ignore read errors for individual images
    }
  }

  return { content };
}

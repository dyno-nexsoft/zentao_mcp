import TurndownService from "turndown";

const turndownService = new TurndownService({
  headingStyle: 'atx',       // Use `#` headings instead of underline style
  bulletListMarker: '-',     // Consistent `-` for unordered lists
  codeBlockStyle: 'fenced',  // Use ``` for code blocks
});

/** Convert HTML to Markdown for better AI readability. */
export function htmlToMarkdown(html: string | undefined | null): string {
  if (!html) return "";
  return turndownService.turndown(html);
}

/** Normalize the ZenTao `files` field (array or keyed object) into a flat array.
 *  Null/undefined items in the source are filtered out defensively.
 */
export function parseFiles(
  files: any
): { id: any; title: string; extension: string; size: any }[] {
  if (!files) return [];
  const mapper = (f: any) => ({
    id: f.id,
    title: f.title || f.name,
    extension: f.extension,
    size: f.size,
  });
  if (Array.isArray(files)) {
    return files.filter(Boolean).map(mapper); // filter null/undefined items
  }
  if (typeof files === "object") {
    return Object.values<any>(files).filter(Boolean).map(mapper);
  }
  return [];
}

/** Format a ZenTao user field (object or string) into a human-readable string. */
export function formatUser(user: any): string {
  if (!user) return "";
  if (typeof user === "object") {
    const name = user.realname || user.account || "";
    const account = user.account ? ` (${user.account})` : "";
    return `${name}${account}`;
  }
  return String(user);
}

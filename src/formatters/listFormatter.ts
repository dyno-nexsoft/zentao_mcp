import { ZentaoClient } from "../zentaoClient.js";

/**
 * Normalize a ZenTao task/bug listing response into a flat array.
 * The REST API returns `{ total, tasks }` / `{ total, bugs }`, but some
 * endpoints return a bare array. Both shapes are handled here.
 */
function asArray(data: any, key: string): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data[key])) return data[key];
  return [];
}

/**
 * Render a list of tasks as a compact Markdown table.
 *
 * @param tasks Raw task objects from the API.
 * @param client Authenticated ZentaoClient used to build task links.
 */
export function tasksToMarkdown(tasks: any[], client: ZentaoClient): string {
  const webUrl = client.webUrl || "";
  const items = asArray(tasks, "tasks");
  if (items.length === 0) {
    return "*No tasks found.*";
  }

  const rows = items.map((t) => {
    const link = webUrl ? `[${t.id}](${webUrl}/task-view-${t.id}.html)` : `${t.id}`;
    return `| ${link} | ${t.name || "N/A"} | ${t.pri ?? "-"} | ${t.status || "N/A"} | ${t.assignedTo?.realname || t.assignedTo?.account || "-"} | ${t.deadline || "-"} |`;
  });

  return [
    `**Total:** ${items.length}`,
    "",
    "| ID | Task | Pri | Status | Assigned | Deadline |",
    "| :--- | :--- | :---: | :---: | :--- | :---: |",
    ...rows,
  ].join("\n");
}

/**
 * Render a list of bugs as a compact Markdown table.
 *
 * @param bugs Raw bug objects from the API.
 * @param client Authenticated ZentaoClient used to build bug links.
 */
export function bugsToMarkdown(bugs: any[], client: ZentaoClient): string {
  const webUrl = client.webUrl || "";
  const items = asArray(bugs, "bugs");
  if (items.length === 0) {
    return "*No bugs found.*";
  }

  const rows = items.map((b) => {
    const link = webUrl ? `[${b.id}](${webUrl}/bug-view-${b.id}.html)` : `${b.id}`;
    return `| ${link} | ${b.title || "N/A"} | ${b.pri ?? "-"} | ${b.severity ?? "-"} | ${b.status || "N/A"} | ${b.assignedTo?.realname || b.assignedTo?.account || "-"} |`;
  });

  return [
    `**Total:** ${items.length}`,
    "",
    "| ID | Title | Pri | Sev | Status | Assigned |",
    "| :--- | :--- | :---: | :---: | :---: | :--- |",
    ...rows,
  ].join("\n");
}

/**
 * Case-insensitive keyword filter for task/bug lists.
 * Matches against task `name` / bug `title` (and, as a fallback, any
 * stringified field) so searches are forgiving.
 *
 * @param items Raw task or bug objects.
 * @param keyword The keyword to match.
 */
export function filterByKeyword(items: any[], keyword: string): any[] {
  const k = (keyword || "").toLowerCase().trim();
  if (!k) return items;
  return items.filter((item) => {
    const name = String(item.name ?? item.title ?? "").toLowerCase();
    return name.includes(k);
  });
}

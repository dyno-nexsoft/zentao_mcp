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

/** Every filter is optional; an item must satisfy all of the provided ones (AND). */
export interface SearchFilters {
  /** Case-insensitive substring match against task `name` / bug `title`. */
  keyword?: string;
  /** Exact match (case-insensitive) against the item's `status`. */
  status?: string;
  /** Exact match against `pri` (1=highest .. 4=lowest). */
  pri?: number;
  /** Exact match against `severity` (bugs only, 1=highest .. 4=lowest). */
  severity?: number;
  /** Exact match (case-insensitive) against the assignee's account. */
  assignedTo?: string;
  /** Only items whose `openedDate` is on/after this date (bugs only, `YYYY-MM-DD`). */
  openedAfter?: string;
  /** Only items whose `openedDate` is on/before this date (bugs only, `YYYY-MM-DD`). */
  openedBefore?: string;
}

/**
 * Filters a task/bug list by any combination of [SearchFilters].
 *
 * ZenTao's REST API has no server-side filtering for most of these (see the
 * module doc in `searchTool.ts`), so every filter here runs client-side over
 * an already-fetched list.
 *
 * @param items Raw task or bug objects.
 * @param filters Filters to apply; an item must match all of the ones set.
 */
export function filterItems(items: any[], filters: SearchFilters): any[] {
  const keyword = (filters.keyword ?? "").toLowerCase().trim();
  const status = filters.status?.toLowerCase().trim();
  const assignedTo = filters.assignedTo?.toLowerCase().trim();

  return items.filter((item) => {
    if (keyword) {
      const name = String(item.name ?? item.title ?? "").toLowerCase();
      if (!name.includes(keyword)) return false;
    }

    if (status && String(item.status ?? "").toLowerCase() !== status) {
      return false;
    }

    if (filters.pri !== undefined && Number(item.pri) !== filters.pri) {
      return false;
    }

    if (filters.severity !== undefined && Number(item.severity) !== filters.severity) {
      return false;
    }

    if (assignedTo) {
      const account = String(item.assignedTo?.account ?? item.assignedTo ?? "").toLowerCase();
      if (account !== assignedTo) return false;
    }

    if (filters.openedAfter || filters.openedBefore) {
      const opened = String(item.openedDate ?? "").slice(0, 10);
      if (!opened) return false;
      if (filters.openedAfter && opened < filters.openedAfter) return false;
      if (filters.openedBefore && opened > filters.openedBefore) return false;
    }

    return true;
  });
}

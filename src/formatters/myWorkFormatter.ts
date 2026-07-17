import { ZentaoClient } from "../zentaoClient.js";

/**
 * Render the "Tasks Assigned to Me" table section.
 *
 * @param taskData A `{ total, tasks }` object from the ZenTao user response.
 * @param webUrl   Web base URL used to build task links.
 */
function renderTasksSection(taskData: any, webUrl: string): string[] {
  const data = taskData || { total: 0, tasks: [] };
  const sections: string[] = ["## Tasks Assigned to Me"];

  if (!data.tasks || data.tasks.length === 0) {
    sections.push("*No tasks assigned to you.*", "");
    return sections;
  }

  sections.push(
    "| ID | Task Name | Pri | Status | Execution | Deadline | Progress |",
    "| :--- | :--- | :---: | :---: | :--- | :---: | :---: |"
  );
  for (const t of data.tasks) {
    const taskLink = webUrl ? `[${t.id}](${webUrl}/task-view-${t.id}.html)` : `${t.id}`;
    const execution = t.executionName || "N/A";
    const prog = t.progress ?? 0;
    const deadline = t.deadline || "N/A";
    sections.push(
      `| ${taskLink} | ${t.name} | ${t.pri} | ${t.status} | ${execution} | ${deadline} | ${prog}% |`
    );
  }
  sections.push("");
  return sections;
}

/**
 * Render the "Bugs Assigned to Me" table section.
 *
 * @param bugData A `{ total, bugs }` object from the ZenTao user response.
 * @param webUrl  Web base URL used to build bug links.
 */
function renderBugsSection(bugData: any, webUrl: string): string[] {
  const data = bugData || { total: 0, bugs: [] };
  const sections: string[] = ["## Bugs Assigned to Me"];

  if (!data.bugs || data.bugs.length === 0) {
    sections.push("*No bugs assigned to you.*", "");
    return sections;
  }

  sections.push(
    "| ID | Bug Title | Pri | Status | Product | Deadline |",
    "| :--- | :--- | :---: | :---: | :--- | :---: |"
  );
  for (const b of data.bugs) {
    const bugLink = webUrl ? `[${b.id}](${webUrl}/bug-view-${b.id}.html)` : `${b.id}`;
    const product = b.productName || "N/A";
    const deadline = b.deadline || "N/A";
    sections.push(
      `| ${bugLink} | ${b.title} | ${b.pri} | ${b.status} | ${product} | ${deadline} |`
    );
  }
  sections.push("");
  return sections;
}

/**
 * Format a raw ZenTao "my work" response object into a human-readable Markdown document.
 *
 * @param myWork The raw "my work" object containing profile, task, and bug lists.
 * @param client Authenticated ZentaoClient to get baseUrl for linking.
 */
export function myWorkToMarkdown(myWork: any, client: ZentaoClient): string {
  if (!myWork) return "No work items found.";

  const profile = myWork.profile || {};
  const taskData = myWork.task || { total: 0, tasks: [] };
  const bugData = myWork.bug || { total: 0, bugs: [] };
  const webUrl = client.webUrl || "";

  return [
    `# Work Items Assigned to ${profile.realname || profile.account || "Me"}`,
    `- **Account:** ${profile.account || "N/A"}`,
    `- **Role:** ${profile.role?.name || "N/A"}`,
    `- **Total Tasks:** ${taskData.total}`,
    `- **Total Bugs:** ${bugData.total}`,
    "",
    ...renderTasksSection(taskData, webUrl),
    ...renderBugsSection(bugData, webUrl),
  ].join("\n");
}

/**
 * Format only the tasks assigned to the current user into Markdown.
 *
 * @param myWork The raw user response (expects a `task` field).
 * @param client Authenticated ZentaoClient to get baseUrl for linking.
 */
export function myTasksToMarkdown(myWork: any, client: ZentaoClient): string {
  if (!myWork) return "No tasks found.";

  const profile = myWork.profile || {};
  const taskData = myWork.task || { total: 0, tasks: [] };
  const webUrl = client.webUrl || "";

  return [
    `# Tasks Assigned to ${profile.realname || profile.account || "Me"}`,
    `- **Total Tasks:** ${taskData.total}`,
    "",
    ...renderTasksSection(taskData, webUrl),
  ].join("\n");
}

/**
 * Format only the bugs assigned to the current user into Markdown.
 *
 * @param myWork The raw user response (expects a `bug` field).
 * @param client Authenticated ZentaoClient to get baseUrl for linking.
 */
export function myBugsToMarkdown(myWork: any, client: ZentaoClient): string {
  if (!myWork) return "No bugs found.";

  const profile = myWork.profile || {};
  const bugData = myWork.bug || { total: 0, bugs: [] };
  const webUrl = client.webUrl || "";

  return [
    `# Bugs Assigned to ${profile.realname || profile.account || "Me"}`,
    `- **Total Bugs:** ${bugData.total}`,
    "",
    ...renderBugsSection(bugData, webUrl),
  ].join("\n");
}

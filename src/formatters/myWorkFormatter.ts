import { ZentaoClient } from "../zentaoClient.js";
import { formatUser } from "../utils/markdownUtils.js";

/**
 * Format a raw ZenTao "my work" response object into a human-readable Markdown document.
 *
 * @param myWork           The raw "my work" object containing profile, task, and bug lists.
 * @param client           Authenticated ZentaoClient to get baseUrl for linking.
 */
export function myWorkToMarkdown(
  myWork: any,
  client: ZentaoClient
): string {
  if (!myWork) return "No work items found.";

  const profile = myWork.profile || {};
  const taskData = myWork.task || { total: 0, tasks: [] };
  const bugData = myWork.bug || { total: 0, bugs: [] };

  const webUrl = client.webUrl || "";

  const header = [
    `# Work Items Assigned to ${profile.realname || profile.account || "Me"}`,
    `- **Account:** ${profile.account || "N/A"}`,
    `- **Role:** ${profile.role?.name || "N/A"}`,
    `- **Total Tasks:** ${taskData.total}`,
    `- **Total Bugs:** ${bugData.total}`,
    ""
  ];

  const sections: string[] = [...header];

  // ── Tasks Section ──
  sections.push("## Tasks Assigned to Me");
  if (taskData.total === 0 || !taskData.tasks || taskData.tasks.length === 0) {
    sections.push("*No tasks assigned to you.*", "");
  } else {
    sections.push(
      "| ID | Task Name | Pri | Status | Execution | Deadline | Progress |",
      "| :--- | :--- | :---: | :---: | :--- | :---: | :---: |"
    );
    for (const t of taskData.tasks) {
      const taskLink = webUrl ? `[${t.id}](${webUrl}/task-view-${t.id}.html)` : `${t.id}`;
      const execution = t.executionName || "N/A";
      const prog = t.progress ?? 0;
      const deadline = t.deadline || "N/A";
      sections.push(
        `| ${taskLink} | ${t.name} | ${t.pri} | ${t.status} | ${execution} | ${deadline} | ${prog}% |`
      );
    }
    sections.push("");
  }

  // ── Bugs Section ──
  sections.push("## Bugs Assigned to Me");
  if (bugData.total === 0 || !bugData.bugs || bugData.bugs.length === 0) {
    sections.push("*No bugs assigned to you.*", "");
  } else {
    sections.push(
      "| ID | Bug Title | Pri | Status | Product | Deadline |",
      "| :--- | :--- | :---: | :---: | :--- | :---: |"
    );
    for (const b of bugData.bugs) {
      const bugLink = webUrl ? `[${b.id}](${webUrl}/bug-view-${b.id}.html)` : `${b.id}`;
      const product = b.productName || "N/A";
      const deadline = b.deadline || "N/A";
      sections.push(
        `| ${bugLink} | ${b.title} | ${b.pri} | ${b.status} | ${product} | ${deadline} |`
      );
    }
    sections.push("");
  }

  return sections.join("\n");
}

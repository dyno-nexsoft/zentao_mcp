/**
 * Pick the array out of a ZenTao listing response, which is either a bare
 * array or an object holding it under `key`.
 */
function asArray(data: any, key: string): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data[key])) return data[key];
  return [];
}

/** Escape the characters that would break a Markdown table cell. */
function cell(value: unknown): string {
  const text = value === undefined || value === null || value === '' ? '-' : String(value);
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** Render rows as a Markdown table with the given header labels. */
function table(headers: string[], rows: unknown[][]): string {
  return [
    `**Total:** ${rows.length}`,
    '',
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => ':---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

/** Render a list of products. */
export function productsToMarkdown(data: any): string {
  const items = asArray(data, 'products');
  if (items.length === 0) return '*No products found.*';
  return table(['ID', 'Name', 'Status'], items.map((p) => [p.id, p.name, p.status]));
}

/** Render a list of projects. */
export function projectsToMarkdown(data: any): string {
  const items = asArray(data, 'projects');
  if (items.length === 0) return '*No projects found.*';
  return table(['ID', 'Name', 'Status', 'Begin', 'End'], items.map((p) => [p.id, p.name, p.status, p.begin, p.end]));
}

/** Render a list of executions. */
export function executionsToMarkdown(data: any): string {
  const items = asArray(data, 'executions');
  if (items.length === 0) return '*No executions found.*';
  return table(['ID', 'Name', 'Status', 'Project'], items.map((e) => [e.id, e.name, e.status, e.project]));
}

/** Render a list of users, optionally keeping the ones matching `keyword`. */
export function usersToMarkdown(data: any, keyword?: string): string {
  const needle = keyword?.trim().toLowerCase();
  const items = asArray(data, 'users').filter((u) =>
    !needle || `${u.account ?? ''} ${u.realname ?? ''}`.toLowerCase().includes(needle)
  );
  if (items.length === 0) return '*No users found.*';
  return table(['Account', 'Name', 'Role'], items.map((u) => [u.account, u.realname, u.role]));
}

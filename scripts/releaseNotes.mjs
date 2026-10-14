import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

/** Release-note sections, in the order they are written, keyed by commit type. */
const SECTIONS = [
  { title: 'Added', types: ['feat'] },
  { title: 'Fixed', types: ['fix'] },
  { title: 'Performance', types: ['perf'] },
  { title: 'Changed', types: ['refactor'] },
  { title: 'Documentation', types: ['docs'] },
  { title: 'Maintenance', types: ['build', 'ci', 'chore', 'test', 'style', 'revert'] },
];

const OTHER_TITLE = 'Other';
const BREAKING_TITLE = 'Breaking changes';
const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

/**
 * Read one commit subject and body as a conventional commit.
 *
 * @param {{ subject: string, body?: string }} commit
 * @returns {{ type: string | null, scope: string | null, description: string, breaking: boolean }}
 */
export function parseCommit({ subject, body = '' }) {
  const match = CONVENTIONAL.exec(subject.trim());
  const breakingFooter = /^BREAKING[ -]CHANGE:/m.test(body);
  if (!match) {
    return { type: null, scope: null, description: subject.trim(), breaking: breakingFooter };
  }
  const [, type, scope, bang, description] = match;
  return {
    type: type.toLowerCase(),
    scope: scope ?? null,
    description,
    breaking: Boolean(bang) || breakingFooter,
  };
}

/** Whether a commit is the release commit made by this workflow. */
function isReleaseCommit({ subject }) {
  return /^chore: release v?\d/.test(subject.trim());
}

/** The line a commit takes in the notes. */
function line({ scope, description }) {
  return scope ? `- **${scope}:** ${description}` : `- ${description}`;
}

/**
 * Group commits into release notes by their conventional type: features,
 * fixes, and so on, with breaking changes first. The release commits of earlier
 * versions are left out.
 *
 * @param {{ subject: string, body?: string }[]} commits Newest first.
 * @returns {string} Markdown, or '' when no commit is left.
 */
export function buildReleaseNotes(commits) {
  const parsed = commits.filter((commit) => !isReleaseCommit(commit)).map(parseCommit);
  if (parsed.length === 0) return '';

  const groups = new Map();
  const add = (title, entry) => groups.set(title, [...(groups.get(title) ?? []), entry]);
  for (const entry of parsed) {
    const section = SECTIONS.find(({ types }) => types.includes(entry.type));
    add(section?.title ?? OTHER_TITLE, entry);
  }

  const blocks = [];
  const breaking = parsed.filter((entry) => entry.breaking);
  if (breaking.length > 0) {
    blocks.push(`### ${BREAKING_TITLE}\n${breaking.map(line).join('\n')}`);
  }
  for (const title of [...SECTIONS.map(({ title }) => title), OTHER_TITLE]) {
    const entries = groups.get(title);
    if (entries) blocks.push(`### ${title}\n${entries.map(line).join('\n')}`);
  }
  return blocks.join('\n\n');
}

/**
 * Put a release entry at the top of a changelog, under its header and above the
 * previous entries.
 *
 * @param {string} changelog Current CHANGELOG.md text.
 * @param {string} version
 * @param {string} date YYYY-MM-DD
 * @param {string} notes Markdown from {@link buildReleaseNotes}.
 */
export function prependChangelogEntry(changelog, version, date, notes) {
  const firstEntry = changelog.indexOf('\n## [');
  if (firstEntry === -1) {
    throw new Error('Could not find a release entry in CHANGELOG.md');
  }
  const header = changelog.slice(0, firstEntry).trimEnd();
  const previousEntries = changelog.slice(firstEntry + 1).trimStart();
  return `${header}\n\n## [${version}] - ${date}\n\n${notes}\n\n---\n\n${previousEntries}`;
}

/** The commits since the previous tag (or all, with none), newest first. */
function commitsSince(previousTag) {
  const range = previousTag ? [`${previousTag}..HEAD`] : [];
  const out = execFileSync(
    'git',
    ['log', '--no-merges', '--format=%s%x1f%b%x1e', ...range],
    { encoding: 'utf8' }
  );
  return out
    .split('\x1e')
    .map((record) => record.replace(/^\n+/, ''))
    .filter(Boolean)
    .map((record) => {
      const [subject, body = ''] = record.split('\x1f');
      return { subject, body };
    });
}

/** The newest tag reachable from HEAD, or '' when there is none yet. */
function latestTag() {
  try {
    return execFileSync('git', ['describe', '--tags', '--abbrev=0'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/**
 * CLI: `node scripts/releaseNotes.mjs --version 1.2.3 --notes notes.md [--changelog CHANGELOG.md]`
 *
 * Writes the notes to `--notes` (the body of the GitHub Release) and, with
 * `--changelog`, adds the dated entry to that file. Exits with an error when
 * nothing has changed since the previous release, so an empty release is not cut.
 */
function main(argv) {
  const args = Object.fromEntries(
    argv.flatMap((arg, i) => (arg.startsWith('--') ? [[arg.slice(2), argv[i + 1]]] : []))
  );
  if (!args.version || !args.notes) {
    throw new Error('Usage: releaseNotes.mjs --version <x.y.z> --notes <file> [--changelog <file>]');
  }

  const notes = buildReleaseNotes(commitsSince(latestTag()));
  if (!notes) {
    throw new Error('Nothing to release: no commits since the previous release.');
  }

  writeFileSync(args.notes, `${notes}\n`);
  if (args.changelog) {
    const date = new Date().toISOString().slice(0, 10);
    const updated = prependChangelogEntry(readFileSync(args.changelog, 'utf8'), args.version, date, notes);
    writeFileSync(args.changelog, updated);
  }
}

if (process.argv[1]?.endsWith('releaseNotes.mjs')) {
  main(process.argv.slice(2));
}

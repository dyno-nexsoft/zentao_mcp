import { buildReleaseNotes, parseCommit, prependChangelogEntry } from '../scripts/releaseNotes.mjs';

describe('parseCommit', () => {
  it('reads type, scope and description', () => {
    expect(parseCommit({ subject: 'fix(client): retry on 401' })).toEqual({
      type: 'fix',
      scope: 'client',
      description: 'retry on 401',
      breaking: false,
    });
  });

  it('flags a bang and a BREAKING CHANGE footer as breaking', () => {
    expect(parseCommit({ subject: 'feat!: drop node 16' }).breaking).toBe(true);
    expect(parseCommit({ subject: 'feat: x', body: 'BREAKING CHANGE: y' }).breaking).toBe(true);
  });

  it('keeps a non-conventional subject whole', () => {
    expect(parseCommit({ subject: 'Update readme' })).toEqual({
      type: null,
      scope: null,
      description: 'Update readme',
      breaking: false,
    });
  });
});

describe('buildReleaseNotes', () => {
  it('groups commits by type in a fixed order', () => {
    const notes = buildReleaseNotes([
      { subject: 'ci: cache npm' },
      { subject: 'fix: stop duplicate login' },
      { subject: 'feat(task): add effort tool' },
      { subject: 'Tidy up' },
    ]);

    expect(notes).toBe(
      [
        '### Added\n- **task:** add effort tool',
        '### Fixed\n- stop duplicate login',
        '### Maintenance\n- cache npm',
        '### Other\n- Tidy up',
      ].join('\n\n')
    );
  });

  it('puts breaking changes first', () => {
    const notes = buildReleaseNotes([{ subject: 'fix: a' }, { subject: 'feat!: b' }]);

    expect(notes.startsWith('### Breaking changes\n- b')).toBe(true);
  });

  it('leaves out earlier release commits and returns nothing when none is left', () => {
    expect(buildReleaseNotes([{ subject: 'chore: release v1.9.1' }])).toBe('');
    expect(buildReleaseNotes([])).toBe('');
  });
});

describe('prependChangelogEntry', () => {
  it('adds the entry above the previous ones', () => {
    const changelog = '# Changelog\n\nIntro.\n\n## [1.0.0] - 2026-01-01\n\n### Added\n- first\n';

    const updated = prependChangelogEntry(changelog, '1.0.1', '2026-02-02', '### Fixed\n- a');

    expect(updated.indexOf('## [1.0.1] - 2026-02-02')).toBeLessThan(updated.indexOf('## [1.0.0]'));
    expect(updated).toContain('### Fixed\n- a\n\n---\n\n## [1.0.0]');
  });

  it('fails when the changelog has no release entry', () => {
    expect(() => prependChangelogEntry('# Changelog\n', '1.0.1', '2026-02-02', 'x')).toThrow();
  });
});

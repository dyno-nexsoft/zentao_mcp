import { filterItems } from '../src/formatters/listFormatter.js';

describe('filterItems', () => {
  const bugs = [
    {
      id: 1,
      title: 'Login crashes on submit',
      status: 'active',
      pri: 1,
      severity: 1,
      assignedTo: { account: 'alice', realname: 'Alice' },
      openedDate: '2026-08-01 10:00:00',
    },
    {
      id: 2,
      title: 'Typo in settings page',
      status: 'resolved',
      pri: 3,
      severity: 4,
      assignedTo: { account: 'bob', realname: 'Bob' },
      openedDate: '2026-08-05 09:00:00',
    },
    {
      id: 3,
      title: 'Crash on logout',
      status: 'closed',
      pri: 2,
      severity: 2,
      assignedTo: 'alice',
      openedDate: '2026-08-10 12:00:00',
    },
  ];

  it('returns everything when no filters are set', () => {
    expect(filterItems(bugs, {})).toHaveLength(3);
  });

  it('filters by keyword against title/name, case-insensitively', () => {
    const result = filterItems(bugs, { keyword: 'CRASH' });
    expect(result.map((b) => b.id)).toEqual([1, 3]);
  });

  it('filters by exact status, case-insensitively', () => {
    const result = filterItems(bugs, { status: 'Resolved' });
    expect(result.map((b) => b.id)).toEqual([2]);
  });

  it('filters by exact priority', () => {
    const result = filterItems(bugs, { pri: 2 });
    expect(result.map((b) => b.id)).toEqual([3]);
  });

  it('filters by exact severity', () => {
    const result = filterItems(bugs, { severity: 1 });
    expect(result.map((b) => b.id)).toEqual([1]);
  });

  it('filters by assignee account, whether assignedTo is an object or a bare string', () => {
    const result = filterItems(bugs, { assignedTo: 'alice' });
    expect(result.map((b) => b.id)).toEqual([1, 3]);
  });

  it('filters by openedAfter/openedBefore date range, inclusive', () => {
    expect(filterItems(bugs, { openedAfter: '2026-08-05' }).map((b) => b.id)).toEqual([2, 3]);
    expect(filterItems(bugs, { openedBefore: '2026-08-05' }).map((b) => b.id)).toEqual([1, 2]);
    expect(
      filterItems(bugs, { openedAfter: '2026-08-02', openedBefore: '2026-08-08' }).map((b) => b.id)
    ).toEqual([2]);
  });

  it('excludes items missing openedDate once a date filter is set', () => {
    const undated = [{ id: 9, title: 'No date', status: 'active' }];
    expect(filterItems(undated, { openedAfter: '2026-01-01' })).toHaveLength(0);
  });

  it('combines every set filter with AND', () => {
    const result = filterItems(bugs, { status: 'active', assignedTo: 'alice', pri: 1 });
    expect(result.map((b) => b.id)).toEqual([1]);

    // Same filters but a priority that doesn't match bug 1 excludes it.
    expect(filterItems(bugs, { status: 'active', assignedTo: 'alice', pri: 2 })).toHaveLength(0);
  });
});

/**
 * Unit tests for formatter functions:
 * - taskToMarkdown
 * - bugToMarkdown
 * - renderHistoryAndComments
 *
 * These tests mock ZentaoClient to avoid any real HTTP calls.
 */

import { jest } from '@jest/globals';

// ─── Mock ZentaoClient ────────────────────────────────────────────────────────
// We need to mock before importing the formatters so the DI client is the mock.
jest.mock('../src/zentaoClient.js', () => ({
  ZentaoClient: jest.fn().mockImplementation(() => ({
    downloadImageToLocal: jest.fn<any>().mockResolvedValue('/tmp/mock_image.png'),
    downloadFile: jest.fn<any>().mockResolvedValue('/tmp/mock_file.pdf'),
  })),
}));

// ─── Mock fs so file-existence checks don't depend on disk state ──────────────
jest.mock('fs', () => {
  const actual = jest.requireActual('fs') as typeof import('fs');
  return {
    ...actual,
    existsSync: jest.fn<any>().mockReturnValue(false),
  };
});

import { ZentaoClient } from '../src/zentaoClient.js';
import { taskToMarkdown } from '../src/formatters/taskFormatter.js';
import { bugToMarkdown } from '../src/formatters/bugFormatter.js';
import { renderHistoryAndComments } from '../src/formatters/actionFormatter.js';

const mockClient = new ZentaoClient() as jest.Mocked<ZentaoClient>;

// ─── taskToMarkdown ───────────────────────────────────────────────────────────

describe('taskToMarkdown', () => {
  it('should return "Task not found." for null input', async () => {
    const result = await taskToMarkdown(null, mockClient);
    expect(result).toBe('Task not found.');
  });

  it('should format a basic task with required fields', async () => {
    const rawTask = {
      id: 42,
      name: 'Fix login bug',
      status: 'doing',
      pri: 2,
      estimate: 4,
      consumed: 1.5,
      left: 2.5,
      progress: 37,
    };

    const result = await taskToMarkdown(rawTask, mockClient);

    expect(result).toContain('# Task #42: Fix login bug');
    expect(result).toContain('**Status:** doing');
    expect(result).toContain('**Priority:** 2');
    expect(result).toContain('4h / 1.5h / 2.5h (37%)');
  });

  it('should include openedBy and assignedTo fields when present', async () => {
    const rawTask = {
      id: 10,
      name: 'Task with users',
      status: 'wait',
      openedBy: { account: 'dyno', realname: 'Dyno Dev' },
      assignedTo: { account: 'ryan', realname: 'Ryan VN' },
    };

    const result = await taskToMarkdown(rawTask, mockClient);

    expect(result).toContain('**Opened by:** Dyno Dev (dyno)');
    expect(result).toContain('**Assigned to:** Ryan VN (ryan)');
  });

  it('should show placeholder when desc is empty', async () => {
    const rawTask = { id: 5, name: 'No desc task', desc: null };
    const result = await taskToMarkdown(rawTask, mockClient);
    expect(result).toContain('*No description provided.*');
  });

  it('should include closedBy with reason when present', async () => {
    const rawTask = {
      id: 99,
      name: 'Closed task',
      status: 'closed',
      closedBy: { account: 'admin', realname: 'Admin' },
      closedReason: 'bydesign',
    };

    const result = await taskToMarkdown(rawTask, mockClient);
    expect(result).toContain('**Closed by:** Admin (admin) (bydesign)');
  });
});

// ─── bugToMarkdown ────────────────────────────────────────────────────────────

describe('bugToMarkdown', () => {
  it('should return "Bug not found." for null input', async () => {
    const result = await bugToMarkdown(null, mockClient);
    expect(result).toBe('Bug not found.');
  });

  it('should format a basic bug with required fields', async () => {
    const rawBug = {
      id: 3815,
      title: 'App crashes on startup',
      status: 'active',
      severity: 3,
      pri: 1,
      type: 'codeerror',
    };

    const result = await bugToMarkdown(rawBug, mockClient);

    expect(result).toContain('# Bug #3815: App crashes on startup');
    expect(result).toContain('**Status:** active');
    expect(result).toContain('**Severity:** 3');
    expect(result).toContain('**Priority:** 1');
    expect(result).toContain('**Type:** codeerror');
  });

  it('should include resolvedBy with resolution when present', async () => {
    const rawBug = {
      id: 100,
      title: 'Resolved bug',
      status: 'resolved',
      resolvedBy: { account: 'dev1', realname: 'Developer One' },
      resolution: 'fixed',
    };

    const result = await bugToMarkdown(rawBug, mockClient);
    expect(result).toContain('**Resolved by:** Developer One (dev1) (fixed)');
  });

  it('should show placeholder when steps are empty', async () => {
    const rawBug = { id: 7, title: 'No steps', steps: null };
    const result = await bugToMarkdown(rawBug, mockClient);
    expect(result).toContain('*No steps provided.*');
  });

  it('should not include closedBy section when closedBy is absent', async () => {
    const rawBug = { id: 8, title: 'Open bug', status: 'active' };
    const result = await bugToMarkdown(rawBug, mockClient);
    expect(result).not.toContain('**Closed by:**');
  });
});

// ─── renderHistoryAndComments ─────────────────────────────────────────────────

describe('renderHistoryAndComments', () => {
  it('should return empty string for null/undefined actions', async () => {
    expect(await renderHistoryAndComments(null, mockClient)).toBe('');
    expect(await renderHistoryAndComments(undefined, mockClient)).toBe('');
    expect(await renderHistoryAndComments([], mockClient)).toBe('');
  });

  it('should render a simple action without comment', async () => {
    const actions = [
      {
        date: '2026-07-01',
        actor: 'Dyno',
        action: 'opened',
        desc: '2026-07-01, 由 Dyno 创建。',
      },
    ];

    const result = await renderHistoryAndComments(actions, mockClient);

    expect(result).toContain('## History & Comments');
    expect(result).toContain('**[2026-07-01]**');
    // Date prefix should be stripped from desc
    expect(result).not.toContain('2026-07-01,');
    expect(result).toContain('Dyno 创建');
  });

  it('should render a comment as blockquote', async () => {
    const actions = [
      {
        date: '2026-07-02',
        actor: 'Ryan',
        action: 'commented',
        desc: 'Ryan 备注。',
        comment: 'Please review this fix.',
      },
    ];

    const result = await renderHistoryAndComments(actions, mockClient);
    expect(result).toContain('> Please review this fix.');
  });

  it('should use fallback desc when act.desc is missing', async () => {
    const actions = [
      {
        date: '2026-07-03',
        actor: 'Admin',
        action: 'someaction',
      },
    ];

    const result = await renderHistoryAndComments(actions, mockClient);
    expect(result).toContain('Admin did action "someaction"');
  });

  it('should render multiple actions in order', async () => {
    const actions = [
      { date: '2026-07-01', actor: 'A', action: 'opened', desc: '创建。' },
      { date: '2026-07-05', actor: 'B', action: 'closed', desc: '关闭。' },
    ];

    const result = await renderHistoryAndComments(actions, mockClient);
    const pos1 = result.indexOf('2026-07-01');
    const pos2 = result.indexOf('2026-07-05');
    expect(pos1).toBeLessThan(pos2);
  });
});

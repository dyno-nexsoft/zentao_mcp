import { jest } from '@jest/globals';
import { registerManageTools } from '../src/tools/manageTool.js';
import { registerLookupTools } from '../src/tools/lookupTool.js';

/** Capture tool handlers registered on a minimal fake McpServer. */
function setup(client: any) {
  const handlers: Record<string, (args: any) => Promise<any>> = {};
  const server: any = {
    registerTool: (name: string, _config: any, handler: any) => {
      handlers[name] = handler;
    },
  };
  registerManageTools(server, client);
  registerLookupTools(server, client);
  return handlers;
}

describe('manage tools', () => {
  it('deletes a task and a bug', async () => {
    const client: any = { deleteTask: jest.fn(async () => ({})), deleteBug: jest.fn(async () => ({})) };
    const handlers = setup(client);

    const task = await handlers.zentao_delete_task({ taskId: 5 });
    const bug = await handlers.zentao_delete_bug({ bugId: 9 });

    expect(client.deleteTask).toHaveBeenCalledWith(5);
    expect(client.deleteBug).toHaveBeenCalledWith(9);
    expect(task.content[0].text).toContain('Task #5 deleted');
    expect(bug.content[0].text).toContain('Bug #9 deleted');
  });

  it('logs effort with the given hours, the date defaulting to today', async () => {
    const client: any = {
      recordTaskEffort: jest.fn(async () => ({})),
      getTaskDetails: jest.fn(async (id: any) => ({ id, name: 'Task', status: 'doing' })),
    };
    const handlers = setup(client);

    await handlers.zentao_record_effort({ taskId: 5, consumed: 2, left: 3, work: 'Wired the list' });

    expect(client.recordTaskEffort).toHaveBeenCalledWith(5, {
      consumed: 2,
      left: 3,
      work: 'Wired the list',
      date: new Date().toISOString().split('T')[0],
    });
  });

  it('does not send work when it is omitted', async () => {
    const client: any = {
      recordTaskEffort: jest.fn(async () => ({})),
      getTaskDetails: jest.fn(async (id: any) => ({ id, name: 'Task', status: 'doing' })),
    };
    const handlers = setup(client);

    await handlers.zentao_record_effort({ taskId: 5, consumed: 1, left: 0, date: '2026-01-02' });

    expect(client.recordTaskEffort).toHaveBeenCalledWith(5, { consumed: 1, left: 0, date: '2026-01-02' });
  });
});

describe('lookup tools', () => {
  it('lists executions of one project', async () => {
    const client: any = { listExecutions: jest.fn(async () => ({ executions: [{ id: 3, name: 'Sprint 1', status: 'doing', project: 2 }] })) };
    const handlers = setup(client);

    const res = await handlers.zentao_list_executions({ projectId: 2 });

    expect(client.listExecutions).toHaveBeenCalledWith(2);
    expect(res.content[0].text).toContain('Sprint 1');
  });

  it('filters users by keyword on account or name', async () => {
    const client: any = {
      listUsers: jest.fn(async () => ({
        users: [
          { account: 'dyno', realname: 'Dyno', role: 'dev' },
          { account: 'grizz', realname: 'Grizz', role: 'qa' },
        ],
      })),
    };
    const handlers = setup(client);

    const res = await handlers.zentao_list_users({ keyword: 'GRI' });

    expect(res.content[0].text).toContain('grizz');
    expect(res.content[0].text).not.toContain('dyno');
  });

  it('says so when there is nothing to list', async () => {
    const client: any = { listProducts: jest.fn(async () => ({ products: [] })) };
    const handlers = setup(client);

    const res = await handlers.zentao_list_products({});

    expect(res.content[0].text).toContain('No products found');
  });
});

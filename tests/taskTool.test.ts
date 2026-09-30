import { jest } from '@jest/globals';
import { registerTaskTools } from '../src/tools/taskTool.js';

/** Capture tool handlers registered on a minimal fake McpServer. */
function setup(createResponse: any) {
  const handlers: Record<string, (args: any) => Promise<any>> = {};
  const server: any = {
    registerTool: (name: string, _config: any, handler: any) => {
      handlers[name] = handler;
    },
  };
  const client: any = {
    createTask: jest.fn(async () => createResponse),
    updateTask: jest.fn(async () => ({})),
    getTaskDetails: jest.fn(async (id: any) => ({ id, name: 'Child', parent: 9 })),
  };
  registerTaskTools(server, client);
  return { handlers, client };
}

describe('task tools: parent', () => {
  it('sends parent on create and links it via edit when the API ignores it', async () => {
    const { handlers, client } = setup({ id: 42, parent: 0 });

    await handlers.zentao_create_task({ executionId: 5, name: 'Child', parent: 9 });

    expect(client.createTask).toHaveBeenCalledWith(5, expect.objectContaining({ parent: 9 }));
    expect(client.updateTask).toHaveBeenCalledWith(42, { parent: 9 });
  });

  it('does not re-link when the create response already has the parent', async () => {
    const { handlers, client } = setup({ id: 42, parent: 9 });

    await handlers.zentao_create_task({ executionId: 5, name: 'Child', parent: 9 });

    expect(client.updateTask).not.toHaveBeenCalled();
  });

  it('does not send parent or re-link when parent is omitted', async () => {
    const { handlers, client } = setup({ id: 42, parent: 0 });

    await handlers.zentao_create_task({ executionId: 5, name: 'Task' });

    expect(client.createTask).toHaveBeenCalledWith(5, expect.not.objectContaining({ parent: expect.anything() }));
    expect(client.updateTask).not.toHaveBeenCalled();
  });

  it('sends parent on edit', async () => {
    const { handlers, client } = setup({});

    await handlers.zentao_edit_task({ taskId: 42, parent: 9 });

    expect(client.updateTask).toHaveBeenCalledWith(42, { parent: 9 });
  });

  it('shows the parent task in the formatted output', async () => {
    const { handlers } = setup({ id: 42, parent: 9 });

    const res = await handlers.zentao_create_task({ executionId: 5, name: 'Child', parent: 9 });

    expect(res.content[0].text).toContain('**Parent task:** #9');
  });
});

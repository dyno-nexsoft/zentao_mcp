import { jest } from '@jest/globals';
import { registerStatusTools } from '../src/tools/statusTool.js';

/** Capture tool handlers registered on a minimal fake McpServer. */
function setup(updatedBug: any) {
  const handlers: Record<string, (args: any) => Promise<any>> = {};
  const server: any = {
    registerTool: (name: string, _config: any, handler: any) => {
      handlers[name] = handler;
    },
  };
  const client: any = {
    updateBugStatus: jest.fn(async () => updatedBug),
  };
  registerStatusTools(server, client);
  return { handlers, client };
}

describe('bug status tool: confirm', () => {
  it('posts the confirm action without resolution fields', async () => {
    const { handlers, client } = setup({ id: 7, title: 'Bug', status: 'active', confirmed: '1' });

    await handlers.zentao_update_bug_status({ bugId: 7, action: 'confirm', comment: 'Fixed in abc123' });

    expect(client.updateBugStatus).toHaveBeenCalledWith(7, 'confirm', { comment: 'Fixed in abc123' });
  });

  it('passes the assignee through when given', async () => {
    const { handlers, client } = setup({ id: 7, title: 'Bug', status: 'active', confirmed: '1' });

    await handlers.zentao_update_bug_status({ bugId: 7, action: 'confirm', assignedTo: 'dyno' });

    expect(client.updateBugStatus).toHaveBeenCalledWith(7, 'confirm', { assignedTo: 'dyno' });
  });

  it('reports a confirmation and shows the confirmed flag', async () => {
    const { handlers } = setup({ id: 7, title: 'Bug', status: 'active', confirmed: '1' });

    const res = await handlers.zentao_update_bug_status({ bugId: 7, action: 'confirm' });
    const text = res.content[0].text;

    expect(text).toContain('Successfully confirmed the bug');
    expect(text).toContain('**Confirmed:** yes');
  });

  it('keeps the status headline for the other actions', async () => {
    const { handlers, client } = setup({ id: 7, title: 'Bug', status: 'resolved' });

    const res = await handlers.zentao_update_bug_status({ bugId: 7, action: 'resolve' });

    expect(client.updateBugStatus).toHaveBeenCalledWith(7, 'resolve', expect.objectContaining({ resolution: 'fixed' }));
    expect(res.content[0].text).toContain("Successfully updated bug status to 'resolved'");
  });
});

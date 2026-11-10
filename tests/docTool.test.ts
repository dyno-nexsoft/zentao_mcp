import { jest } from '@jest/globals';
import { registerDocTool, parseDocId } from '../src/tools/docTool.js';

/** Capture tool handlers registered on a minimal fake McpServer. */
function setup(client: any) {
  const handlers: Record<string, (args: any) => Promise<any>> = {};
  const server: any = {
    registerTool: (name: string, _config: any, handler: any) => {
      handlers[name] = handler;
    },
  };
  registerDocTool(server, client);
  return handlers;
}

function fakeClient(doc: any) {
  return {
    webUrl: 'https://zentao.example.com/zentao',
    getDocDetails: jest.fn(async () => doc),
  };
}

describe('parseDocId', () => {
  it('accepts an ID, a doc-view link, or a docID query param', () => {
    expect(parseDocId(96)).toBe('96');
    expect(parseDocId(' 96 ')).toBe('96');
    expect(parseDocId('https://zentao.example.com/zentao/doc-view-96.html')).toBe('96');
    expect(parseDocId('https://zentao.example.com/zentao/index.php?m=doc&f=view&docID=96')).toBe('96');
    expect(parseDocId('not a doc')).toBeNull();
  });
});

describe('zentao_get_doc', () => {
  it('fetches the doc by the ID in a link and renders HTML content as Markdown', async () => {
    const client = fakeClient({
      id: 96,
      title: 'Swap-Bridge APIs',
      type: 'text',
      contentType: 'doc',
      libName: 'Wallet',
      version: 6,
      addedBy: { account: 'Tommy', realname: 'Saul' },
      addedDate: '2026-08-13T07:11:55Z',
      content: '<div><h3>Get Bridge Routes</h3><ul><li>Method GetBridgeRoute</li></ul></div>',
      files: [],
    });
    const handlers = setup(client);

    const res = await handlers.zentao_get_doc({ doc: 'https://zentao.example.com/zentao/doc-view-96.html' });
    const text = res.content[0].text;

    expect(client.getDocDetails).toHaveBeenCalledWith('96');
    expect(text).toContain('# Doc #96: Swap-Bridge APIs');
    expect(text).toContain('**Library:** Wallet');
    expect(text).toContain('Saul (Tommy)');
    expect(text).toContain('### Get Bridge Routes');
    expect(text).toContain('-   Method GetBridgeRoute');
    expect(text).toContain('https://zentao.example.com/zentao/doc-view-96.html');
  });

  it('keeps Markdown docs as written', async () => {
    const client = fakeClient({ id: 7, title: 'Notes', type: 'text', contentType: 'markdown', content: '## Raw *md*' });
    const handlers = setup(client);

    const res = await handlers.zentao_get_doc({ doc: 7 });

    expect(res.content[0].text).toContain('## Raw *md*');
  });

  it('shows the target of a link doc', async () => {
    const client = fakeClient({ id: 8, title: 'Spec', type: 'url', content: 'https://example.com/spec' });
    const handlers = setup(client);

    const res = await handlers.zentao_get_doc({ doc: 8 });

    expect(res.content[0].text).toContain('External link: https://example.com/spec');
  });

  it('rejects input without a doc ID instead of calling the API', async () => {
    const client = fakeClient({});
    const handlers = setup(client);

    const res = await handlers.zentao_get_doc({ doc: 'https://zentao.example.com/zentao/bug-view-1.html' });

    expect(client.getDocDetails).not.toHaveBeenCalled();
    expect(res.content[0].text).toContain('Could not find a doc ID');
  });
});

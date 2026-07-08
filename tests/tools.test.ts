import { jest } from '@jest/globals';
import fs from 'fs';

// Create a mock server
const mockRegisterTool = jest.fn<any>();
const mockMcpServerInstance = {
  registerTool: mockRegisterTool
};

import { registerTools } from '../src/tools.js';
import { ZentaoClient } from '../src/zentaoClient.js';

describe('Tools', () => {
  let downloadHandler: (args: any) => Promise<any>;
  let taskHandler: (args: any) => Promise<any>;
  let bugHandler: (args: any) => Promise<any>;

  beforeAll(() => {
    // Register tools on the mock server
    registerTools(mockMcpServerInstance as any);

    const calls = mockRegisterTool.mock.calls;

    const downloadCall = calls.find((call: any) => call[0] === 'zentao_download_attachment');
    if (!downloadCall) {
      throw new Error('zentao_download_attachment tool not registered');
    }
    downloadHandler = downloadCall[2] as any;

    const taskCall = calls.find((call: any) => call[0] === 'zentao_get_task_details');
    if (!taskCall) {
      throw new Error('zentao_get_task_details tool not registered');
    }
    taskHandler = taskCall[2] as any;

    const bugCall = calls.find((call: any) => call[0] === 'zentao_get_bug_details');
    if (!bugCall) {
      throw new Error('zentao_get_bug_details tool not registered');
    }
    bugHandler = bugCall[2] as any;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('zentao_download_attachment', () => {
    it('should return already exists message if file exists on disk', async () => {
      const spyExists = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const spyDownload = jest.spyOn(ZentaoClient.prototype, 'downloadFile').mockResolvedValue('mock-path');

      const result = await downloadHandler({ fileId: 123, extension: 'png' });

      expect(spyExists).toHaveBeenCalled();
      expect(spyDownload).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('File already exists locally at');
    });

    it('should download the file if it does not exist on disk', async () => {
      const spyExists = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const spyDownload = jest.spyOn(ZentaoClient.prototype, 'downloadFile').mockResolvedValue('mock-path');

      const result = await downloadHandler({ fileId: 123, extension: 'png' });

      expect(spyExists).toHaveBeenCalled();
      expect(spyDownload).toHaveBeenCalledWith(123, expect.any(String));
      expect(result.content[0].text).toContain('File downloaded successfully to');
    });

    it('should collapse concurrent downloads and call downloadFile only once', async () => {
      const spyExists = jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      // We want to control when downloadFile resolves to simulate concurrent requests
      let resolveDownload: (value: string) => void = () => {};
      const downloadPromise = new Promise<string>((resolve) => {
        resolveDownload = resolve;
      });

      const spyDownload = jest.spyOn(ZentaoClient.prototype, 'downloadFile').mockReturnValue(downloadPromise);

      // Fire two concurrent download requests
      const promise1 = downloadHandler({ fileId: 999, extension: 'jpg' });
      const promise2 = downloadHandler({ fileId: 999, extension: 'jpg' });

      // Resolve the download
      resolveDownload('mock-path-999');

      const [res1, res2] = await Promise.all([promise1, promise2]);

      // downloadFile should only be called once
      expect(spyDownload).toHaveBeenCalledTimes(1);

      expect(res1.content[0].text).toContain('File downloaded successfully to');
      expect(res2.content[0].text).toContain('File downloaded successfully to');
    });
  });

  describe('Task & Bug Details HTML to Markdown Conversion', () => {
    it('should clean task details and convert HTML desc to Markdown', async () => {
      const mockTask = {
        id: 101,
        name: 'Test Task',
        status: 'doing',
        desc: '<p>This is a <strong>bold</strong> task desc.</p><p>With a <a href="http://example.com">link</a> and a <br/> break.</p>'
      };

      const spyGetTask = jest.spyOn(ZentaoClient.prototype, 'getTaskDetails').mockResolvedValue(mockTask);

      const result = await taskHandler({ taskId: 101 });
      const md = result.content[0].text;

      expect(spyGetTask).toHaveBeenCalledWith(101);
      expect(md).toContain('# Task #101: Test Task');
      expect(md).toContain('- **Status**: doing');
      expect(md).toContain('This is a **bold** task desc.\n\nWith a [link](http://example.com) and a  \nbreak.');
    });

    it('should clean bug details and convert HTML steps to Markdown', async () => {
      const mockBug = {
        id: 202,
        title: 'Test Bug',
        status: 'active',
        steps: '<ol><li>Step 1</li><li>Step 2 &amp; test</li></ol>'
      };

      const spyGetBug = jest.spyOn(ZentaoClient.prototype, 'getBugDetails').mockResolvedValue(mockBug);

      const result = await bugHandler({ bugId: 202 });
      const md = result.content[0].text;

      expect(spyGetBug).toHaveBeenCalledWith(202);
      expect(md).toContain('# Bug #202: Test Bug');
      expect(md).toContain('- **Status**: active');
      expect(md).toContain('1.  Step 1\n2.  Step 2 & test');
    });
  });
});

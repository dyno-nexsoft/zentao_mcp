import { jest } from '@jest/globals';
import fs from 'fs';

// Create a mock server
const mockRegisterTool = jest.fn<any>();
const mockMcpServerInstance = {
  registerTool: mockRegisterTool
};

import { registerTools } from '../src/tools.js';
import { ZentaoClient } from '../src/zentaoClient.js';

describe('Tools - zentao_download_attachment', () => {
  let downloadHandler: (args: any) => Promise<any>;

  beforeAll(() => {
    // Register tools on the mock server
    registerTools(mockMcpServerInstance as any);

    // Find the handler for zentao_download_attachment
    const calls = mockRegisterTool.mock.calls;
    const downloadCall = calls.find((call: any) => call[0] === 'zentao_download_attachment');
    if (!downloadCall) {
      throw new Error('zentao_download_attachment tool not registered');
    }
    // The third argument is the handler
    downloadHandler = downloadCall[2] as any;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

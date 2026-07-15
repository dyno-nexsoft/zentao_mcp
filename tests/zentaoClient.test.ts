import { jest } from '@jest/globals';

const mockAxiosInstance = {
  get: jest.fn<any>(),
  post: jest.fn<any>(),
  interceptors: {
    request: {
      use: jest.fn<any>()
    },
    response: {
      use: jest.fn<any>()
    }
  }
};

// Capture interceptor callbacks
let requestInterceptorCallback: ((config: any) => Promise<any>) | null = null;
let responseSuccessCallback: ((response: any) => any) | null = null;
let responseErrorCallback: ((error: any) => Promise<any>) | null = null;

mockAxiosInstance.interceptors.request.use.mockImplementation((callback: any) => {
  requestInterceptorCallback = callback;
  return 0; // dummy ID
});

mockAxiosInstance.interceptors.response.use.mockImplementation((success: any, error: any) => {
  responseSuccessCallback = success;
  responseErrorCallback = error;
  return 0; // dummy ID
});

// Configure env vars before importing ZentaoClient
process.env.ZENTAO_ACCOUNT = 'test_user';
process.env.ZENTAO_PASSWORD = 'test_password';
process.env.ZENTAO_BASE_URL = 'https://zentao.example.com/api/v1';

import { ZentaoClient } from '../src/zentaoClient.js';

describe('ZentaoClient', () => {
  let client: ZentaoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ZentaoClient(mockAxiosInstance as any);
  });

  describe('Login', () => {
    it('should login successfully and store the token', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { token: 'mock-token-abc' }
      });

      await client.login();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/tokens', {
        account: 'test_user',
        password: 'test_password'
      });
    });

    it('should throw an error if token is not in the response', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: {} });

      await expect(client.login()).rejects.toThrow('Login failed: Token not found in response');
    });
  });

  describe('Interceptors', () => {
    it('should automatically login and inject Token header in requests', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { token: 'new-token-xyz' }
      });

      const mockConfig = {
        headers: {} as Record<string, string>,
        url: '/tasks/1'
      };

      if (!requestInterceptorCallback) {
        throw new Error('Request interceptor not registered');
      }

      const resultConfig = await requestInterceptorCallback(mockConfig);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/tokens', {
        account: 'test_user',
        password: 'test_password'
      });
      expect(resultConfig.headers['Token']).toBe('new-token-xyz');
    });

    it('should bypass token injection for the /tokens endpoint', async () => {
      const mockConfig = {
        headers: {} as Record<string, string>,
        url: '/tokens'
      };

      if (!requestInterceptorCallback) {
        throw new Error('Request interceptor not registered');
      }

      const resultConfig = await requestInterceptorCallback(mockConfig);

      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
      expect(resultConfig.headers['Token']).toBeUndefined();
    });

    it('should retry request on 401 response error', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { token: 'retried-token' }
      });

      // Mock original request that failed
      const mockConfig = {
        headers: {} as Record<string, string>,
        url: '/tasks/2',
        _retry: false
      };
      
      const mockError = {
        config: mockConfig,
        response: { status: 401 }
      };

      if (!responseErrorCallback) {
        throw new Error('Response error interceptor not registered');
      }

      // Mock client invocation for retry (callable function with post method attached)
      const mockClientFn = jest.fn<any>().mockResolvedValueOnce({ data: 'success' });
      (mockClientFn as any).post = mockAxiosInstance.post;
      (client as any).client = mockClientFn;

      await responseErrorCallback(mockError);

      expect(mockAxiosInstance.post).toHaveBeenCalled();
      expect(mockConfig._retry).toBe(true);
      expect(mockConfig.headers['Token']).toBe('retried-token');
    });
  });

  describe('Caching', () => {
    it('should cache task details and reuse cached value on subsequent requests', async () => {
      const mockTaskData = { id: 1, name: 'Task 1' };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockTaskData });

      // First call (hits API)
      const res1 = await client.getTaskDetails(1);
      expect(res1).toEqual(mockTaskData);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);

      // Second call (uses cache)
      const res2 = await client.getTaskDetails(1);
      expect(res2).toEqual(mockTaskData);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1); // Still 1 call
    });

    it('should bypass cache after clearCache is called', async () => {
      const mockTaskData = { id: 1, name: 'Task 1' };
      mockAxiosInstance.get.mockResolvedValue({ data: mockTaskData });

      await client.getTaskDetails(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);

      client.clearCache();

      await client.getTaskDetails(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2); // Hits API again
    });

    it('should cache bug details', async () => {
      const mockBugData = { id: 2, title: 'Bug 2' };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockBugData });

      const res1 = await client.getBugDetails(2);
      expect(res1).toEqual(mockBugData);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);

      const res2 = await client.getBugDetails(2);
      expect(res2).toEqual(mockBugData);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it('should fallback to classic JSON API for bug details when REST API returns empty string', async () => {
      // First call to REST API `/bugs/3` returns empty string ""
      mockAxiosInstance.get.mockResolvedValueOnce({ data: "" });
      
      // Second call to classic JSON API `/bug-view-3.json` returns success response
      const mockClassicResponse = {
        status: 'success',
        data: JSON.stringify({
          bug: {
            id: 3,
            title: 'Mocked Fallback Bug',
            openedBy: 'Ryan',
            assignedTo: 'closed',
            resolvedBy: '',
            closedBy: ''
          },
          users: {
            'Ryan': 'Ryan_VN_test',
            'closed': 'Closed'
          },
          actions: {
            '1001': { id: 1001, actor: 'Ryan', action: 'opened', date: '2026-06-02 18:15:06', extra: '' }
          }
        })
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockClassicResponse });

      const result = await client.getBugDetails(3);
      
      // Verify REST API and Classic API were called
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/bugs/3');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('https://zentao.example.com/bug-view-3.json', { baseURL: '' });
      
      // Verify data normalization
      expect(result.id).toBe(3);
      expect(result.title).toBe('Mocked Fallback Bug');
      expect(result.openedBy).toEqual({ account: 'Ryan', realname: 'Ryan_VN_test' });
      expect(result.assignedTo).toBeNull();
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].desc).toContain('创建');
    });

    it('should fallback to classic JSON API for task details when REST API throws error', async () => {
      // First call to REST API `/tasks/4` throws error
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('REST API Failed'));
      
      // Second call to classic JSON API `/task-view-4.json` returns success response
      const mockClassicResponse = {
        status: 'success',
        data: JSON.stringify({
          task: {
            id: 4,
            name: 'Mocked Fallback Task',
            openedBy: 'Dyno',
            assignedTo: 'Ryan',
            resolvedBy: '',
            closedBy: ''
          },
          users: {
            'Dyno': 'Dyno-VN-Flutter',
            'Ryan': 'Ryan_VN_test'
          },
          actions: [
            { id: 2001, actor: 'Dyno', action: 'opened', date: '2026-06-02 18:15:06', extra: '' }
          ]
        })
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockClassicResponse });

      const result = await client.getTaskDetails(4);
      
      // Verify REST API and Classic API were called
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/tasks/4');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('https://zentao.example.com/task-view-4.json', { baseURL: '' });
      
      // Verify data normalization
      expect(result.id).toBe(4);
      expect(result.name).toBe('Mocked Fallback Task');
      expect(result.openedBy).toEqual({ account: 'Dyno', realname: 'Dyno-VN-Flutter' });
      expect(result.assignedTo).toEqual({ account: 'Ryan', realname: 'Ryan_VN_test' });
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].desc).toContain('创建');
    });
  });

  describe('Comments', () => {
    it('should add a comment using the classic action comment endpoint', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { token: 'mock-token' } }) // login
        .mockResolvedValueOnce({ data: '<html>parent.location.reload(true)</html>', status: 200 }); // addComment

      const result = await client.addComment('task', 8560, 'Test comment');

      expect(result).toEqual({ result: 'success', message: 'Comment added successfully' });
      expect(mockAxiosInstance.post).toHaveBeenLastCalledWith(
        'https://zentao.example.com/action-comment-task-8560.json?zentaosid=mock-token',
        expect.any(URLSearchParams),
        expect.objectContaining({
          baseURL: '',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );
    });
  });
});

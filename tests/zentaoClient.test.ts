import { jest } from '@jest/globals';

const mockAxiosInstance = {
  get: jest.fn<any>(),
  post: jest.fn<any>(),
  put: jest.fn<any>(),
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

  describe('My Work', () => {
    it('should fetch tasks and bugs assigned to me', async () => {
      const mockWorkData = {
        profile: { account: 'test_user', realname: 'Test User' },
        task: { total: 1, tasks: [{ id: 1, name: 'Task 1' }] },
        bug: { total: 0, bugs: [] }
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockWorkData });

      const res = await client.getMyWork();
      expect(res).toEqual(mockWorkData);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/user?fields=task,bug&type=assignedTo');
    });

    it('should fetch only tasks assigned to me', async () => {
      const mockData = {
        profile: { account: 'test_user' },
        task: { total: 1, tasks: [{ id: 1, name: 'Task 1' }] }
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockData });

      const res = await client.getMyTasks();
      expect(res).toEqual(mockData);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/user?fields=task&type=assignedTo');
    });

    it('should fetch only bugs assigned to me', async () => {
      const mockData = {
        profile: { account: 'test_user' },
        bug: { total: 1, bugs: [{ id: 2, title: 'Bug 2' }] }
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockData });

      const res = await client.getMyBugs();
      expect(res).toEqual(mockData);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/user?fields=bug&type=assignedTo');
    });

    it('should expose the correct webUrl', () => {
      expect(client.webUrl).toBe('https://zentao.example.com');
    });
  });

  describe('Tasks', () => {
    it('should create a task under an execution', async () => {
      const created = { id: 100, name: 'New Task' };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: created });

      const payload = { name: 'New Task', type: 'devel' };
      const res = await client.createTask(5, payload);

      expect(res).toEqual(created);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/executions/5/tasks', payload);
    });

    it('should update a task via PUT and clear the cache', async () => {
      const updated = { id: 100, name: 'Renamed Task' };
      mockAxiosInstance.put.mockResolvedValueOnce({ data: updated });

      const res = await client.updateTask(100, { name: 'Renamed Task' });

      expect(res).toEqual(updated);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/tasks/100', { name: 'Renamed Task' });
    });

    it('should list tasks under an execution', async () => {
      const data = { total: 2, tasks: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] };
      mockAxiosInstance.get.mockResolvedValueOnce({ data });

      const res = await client.listExecutionTasks(7);

      expect(res).toEqual(data);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/executions/7/tasks');
    });
  });

  describe('Bugs', () => {
    it('should create a bug under a product', async () => {
      const created = { id: 200, title: 'New Bug' };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: created });

      const payload = { title: 'New Bug', severity: 2 };
      const res = await client.createBug(3, payload);

      expect(res).toEqual(created);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/products/3/bugs', payload);
    });

    it('should update a bug via PUT', async () => {
      const updated = { id: 200, title: 'Renamed Bug' };
      mockAxiosInstance.put.mockResolvedValueOnce({ data: updated });

      const res = await client.updateBug(200, { title: 'Renamed Bug' });

      expect(res).toEqual(updated);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/bugs/200', { title: 'Renamed Bug' });
    });

    it('should list bugs under a product', async () => {
      const data = { total: 1, bugs: [{ id: 9, title: 'Bug 9' }] };
      mockAxiosInstance.get.mockResolvedValueOnce({ data });

      const res = await client.listProductBugs(4);

      expect(res).toEqual(data);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/products/4/bugs');
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

    it('should edit a comment using the classic editComment endpoint', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { token: 'mock-token' } }) // login
        .mockResolvedValueOnce({ data: '<html>parent.location.reload(true)</html>', status: 200 }); // editComment

      const result = await client.editComment(999, 'Edited comment text');

      expect(result).toEqual({ result: 'success', message: 'Comment updated successfully' });

      // Verify the edited text is sent under the `lastComment` field.
      const [, sentParams] = mockAxiosInstance.post.mock.calls.at(-1) as [string, URLSearchParams, any];
      expect(sentParams.get('lastComment')).toBe('Edited comment text');
      expect(mockAxiosInstance.post).toHaveBeenLastCalledWith(
        'https://zentao.example.com/action-editComment-999.json?zentaosid=mock-token',
        expect.any(URLSearchParams),
        expect.objectContaining({
          baseURL: '',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );
    });

    it('should delete (hide) a comment using the classic hideOne endpoint', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { token: 'mock-token' } }) // login
        .mockResolvedValueOnce({ data: { result: 'success' }, status: 200 }); // hideOne

      const result = await client.deleteComment(999);

      expect(result).toEqual({ result: 'success', message: 'Comment deleted (hidden) successfully' });
      expect(mockAxiosInstance.post).toHaveBeenLastCalledWith(
        'https://zentao.example.com/action-hideOne-999.json?zentaosid=mock-token',
        expect.any(URLSearchParams),
        expect.objectContaining({ baseURL: '' })
      );
    });
  });
});

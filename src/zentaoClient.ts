import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as https from 'https';
import * as stream from 'stream';

dotenv.config();

/**
 * Resolution label map for bug actions.
 * Defined at module level to avoid re-allocating the object on every call to
 * `generateActionDesc`.
 */
const RESOLUTION_LABEL_MAP: Record<string, string> = {
  fixed:       '已解决',
  design:      '设计如此',
  duplicate:   '重复Bug',
  external:    '外部原因',
  notrepro:    '无法重现',
  postponed:   '延期处理',
  willnotfix:  '不予解决',
  tostory:     '转为需求',
};

/**
 * User fields that may be stored as a plain account string in the classic API
 * and need to be normalised to `{ account, realname }` objects.
 */
const USER_FIELDS = [
  'openedBy', 'assignedTo', 'resolvedBy',
  'closedBy', 'finishedBy', 'canceledBy', 'lastEditedBy',
] as const;

/**
 * Client for communicating with the Zentao API.
 * Handles authentication, automatic token injection, session expiration retries,
 * and standard API requests for projects, executions, tasks, bugs, and attachments.
 */
export class ZentaoClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private account = process.env.ZENTAO_ACCOUNT || '';
  private password = process.env.ZENTAO_PASSWORD || '';
  private baseUrl = process.env.ZENTAO_BASE_URL || '';
  private getCache = new Map<string, { data: any; timestamp: number }>();
  private cacheTtlMs = 2 * 60 * 1000; // 2 minutes TTL
  /** In-flight request map prevents cache stampede under concurrent calls. */
  private inFlightRequests = new Map<string, Promise<any>>();

  // ─── Computed properties ─────────────────────────────────────────────────────

  /**
   * Returns the web base URL (without the API path suffix).
   * Used by both `getFallbackClassicData` and `addComment` to avoid duplicating
   * the same string-split logic in two places.
   */
  private get webBaseUrl(): string {
    if (this.baseUrl.includes('/api.php/v1')) {
      return this.baseUrl.split('/api.php/v1')[0];
    }
    return this.baseUrl.split('/api/v1')[0];
  }

  /**
   * Public getter exposing the web base URL.
   */
  public get webUrl(): string {
    return this.webBaseUrl;
  }

  // ─── Cache helpers ────────────────────────────────────────────────────────────

  /**
   * Clears the in-memory cache for GET requests. Helpful for testing.
   */
  public clearCache(): void {
    this.getCache.clear();
  }

  /**
   * Helper method to perform GET requests with caching.
   * 
   * @param url The API endpoint path.
   * @returns The response data.
   */
  private async get<T>(url: string): Promise<T> {
    const cached = this.getCache.get(url);
    const now = Date.now();
    if (cached && now - cached.timestamp < this.cacheTtlMs) {
      return cached.data;
    }

    // If a request for this URL is already in-flight, reuse its promise
    // instead of firing a duplicate HTTP request (prevents cache stampede).
    if (this.inFlightRequests.has(url)) {
      return this.inFlightRequests.get(url) as Promise<T>;
    }

    const requestPromise = this.client
      .get<T>(url)
      .then((res) => {
        this.getCache.set(url, { data: res.data, timestamp: Date.now() });
        return res.data;
      })
      .finally(() => {
        this.inFlightRequests.delete(url);
      });

    this.inFlightRequests.set(url, requestPromise);
    return requestPromise;
  }

  // ─── Constructor & interceptors ───────────────────────────────────────────────

  /**
   * Initializes the Axios client with base configurations and registers interceptors
   * to automatically inject token headers and handle token expiration (401 errors).
   * 
   * @param customClient Optional custom AxiosInstance for dependency injection/testing.
   */
  constructor(customClient?: AxiosInstance) {
    const allowInsecure = process.env.ZENTAO_ALLOW_INSECURE_SSL === 'true';
    this.client = customClient || axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      httpsAgent: allowInsecure
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined,
    });

    // Add a request interceptor to automatically add the token and handle retries
    this.client.interceptors.request.use(async (config) => {
      // Don't add token if we are requesting a token
      if (config.url === '/tokens') return config;

      if (!this.token) {
        await this.login();
      }
      
      if (this.token) {
        config.headers['Token'] = this.token;
      }
      return config;
    });

    // Add response interceptor to handle 401 Unauthorized (token expiry)
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/tokens') {
          originalRequest._retry = true;
          await this.login();
          if (this.token) {
            originalRequest.headers['Token'] = this.token;
            return this.client(originalRequest);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ─── Authentication ───────────────────────────────────────────────────────────

  /**
   * Performs authentication request to Zentao API to obtain a token.
   * Updates the internal token state upon successful login.
   * 
   * @throws {Error} If account/password env vars are missing or if the API request fails.
   */
  public async login(): Promise<void> {
    if (!this.account || !this.password) {
      throw new Error('ZENTAO_ACCOUNT or ZENTAO_PASSWORD is not set in environment variables');
    }
    const response = await this.client.post('/tokens', {
      account: this.account,
      password: this.password,
    });
    if (response.data && response.data.token) {
      this.token = response.data.token;
    } else {
      throw new Error('Login failed: Token not found in response');
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Helper to generate standard action descriptions when they are not present in classic API.
   */
  private generateActionDesc(act: any, userMap: Record<string, string>): string {
    const actorName = userMap[act.actor] || act.actor || 'User';
    let extraName = act.extra || '';
    if (userMap[extraName]) {
      extraName = userMap[extraName];
    } else if (RESOLUTION_LABEL_MAP[extraName]) {
      extraName = RESOLUTION_LABEL_MAP[extraName];
    }

    switch (act.action) {
      case 'opened':
        return `由 <strong>${actorName}</strong> 创建。`;
      case 'assigned':
        return `由 <strong>${actorName}</strong> 指派给 <strong>${extraName}</strong>。`;
      case 'started':
        if (act.extra === 'autobychild') {
          return `由 <strong>${actorName}</strong> 启动子任务，该任务自动启动。`;
        }
        return `由 <strong>${actorName}</strong> 启动。`;
      case 'finished':
        return `由 <strong>${actorName}</strong> 完成。`;
      case 'resolved':
        return `由 <strong>${actorName}</strong> 解决，方案为 <strong>${extraName}</strong>。`;
      case 'closed':
        return `由 <strong>${actorName}</strong> 关闭。`;
      case 'edited':
        return `由 <strong>${actorName}</strong> 编辑。`;
      case 'bugconfirmed':
      case 'confirmed':
        return `由 <strong>${actorName}</strong> 确认Bug。`;
      case 'activated':
        return `由 <strong>${actorName}</strong> 激活。`;
      case 'commented':
        return `由 <strong>${actorName}</strong> 备注。`;
      case 'createchildren':
        return `由 <strong>${actorName}</strong> 创建子任务 ${act.extra || ''}。`;
      default:
        if (act.action && act.action.startsWith('subtask')) {
          return `由 <strong>${actorName}</strong> ${act.action}。`;
        }
        return `由 <strong>${actorName}</strong> 执行了 <strong>${act.action || '未知'}</strong> 操作。`;
    }
  }

  /**
   * Fetches classic JSON API fallback data when REST API returns empty/errors.
   */
  private async getFallbackClassicData(type: 'bug' | 'task', id: string | number): Promise<any> {
    const url = `${this.webBaseUrl}/${type}-view-${id}.json`;
    
    const res = await this.client.get(url, {
      baseURL: '', // override baseURL
    });

    const responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    if (responseData && responseData.status === 'success') {
      const detailData = typeof responseData.data === 'string' ? JSON.parse(responseData.data) : responseData.data;
      if (detailData) {
        const entity = detailData[type];
        if (entity) {
          const userMap = detailData.users || {};
          
          // Normalize user fields
          for (const field of USER_FIELDS) {
            const val = entity[field];
            if (val && typeof val === 'string') {
              entity[field] = {
                account: val,
                realname: userMap[val] || val
              };
            }
          }

          if (entity.assignedTo?.account === 'closed') {
            entity.assignedTo = null;
          }

          // Normalize actions list to sorted array
          let actionsArray: any[] = [];
          if (detailData.actions) {
            if (Array.isArray(detailData.actions)) {
              actionsArray = detailData.actions;
            } else if (typeof detailData.actions === 'object') {
              actionsArray = Object.values(detailData.actions);
              actionsArray.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
            }
          }

          // Generate descriptions if missing
          for (const act of actionsArray) {
            if (!act.desc) {
              act.desc = `${act.date || ''}, ` + this.generateActionDesc(act, userMap);
            }
          }
          
          entity.actions = actionsArray;
          return entity;
        }
      }
    }
    throw new Error(`Failed to fetch ${type} details from classic fallback API for ID ${id}`);
  }

  /**
   * Generic helper that fetches entity details from the REST API and falls back
   * to the classic JSON API when the REST response is empty or throws an error.
   * Caches the fallback result under the REST API key so subsequent calls are fast.
   *
   * @param restUrl   The REST API path (e.g. `/tasks/1`).
   * @param type      Entity type passed to `getFallbackClassicData`.
   * @param id        Entity ID passed to `getFallbackClassicData`.
   */
  private async getWithFallback(restUrl: string, type: 'bug' | 'task', id: string | number): Promise<any> {
    const runFallback = async () => {
      const data = await this.getFallbackClassicData(type, id);
      // Cache the fallback result under the REST key so repeated calls are fast.
      this.getCache.set(restUrl, { data, timestamp: Date.now() });
      return data;
    };

    try {
      const data = await this.get<any>(restUrl);
      if (!data || data === '') {
        return runFallback();
      }
      return data;
    } catch {
      return runFallback();
    }
  }

  /**
   * Shared stream-to-file helper used by `downloadFile` and `downloadImageToLocal`.
   * Pipes a readable stream to a local file path, removing the partial file on error.
   *
   * @param readable    A Node.js Readable stream (axios response body).
   * @param targetPath  The local file path to write to.
   * @returns Resolves with `targetPath` on success.
   */
  private pipeStreamToFile(readable: stream.Readable, targetPath: string): Promise<string> {
    const writer = fs.createWriteStream(targetPath);
    return new Promise((resolve, reject) => {
      readable.pipe(writer);
      let writeError: Error | null = null;
      writer.on('error', (err) => {
        writeError = err;
        writer.close();
        // Remove the partial/corrupt file so future calls don't mistake it for a valid download.
        fs.unlink(targetPath, () => { /* best-effort cleanup */ });
        reject(err);
      });
      writer.on('close', () => {
        if (!writeError) resolve(targetPath);
      });
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  /**
   * Retrieves tasks and bugs assigned to the current user (my work).
   *
   * @returns Resolves with the user's work items (tasks and bugs).
   */
  public async getMyWork(): Promise<any> {
    return this.get<any>('/user?fields=task,bug&type=assignedTo');
  }

  /**
   * Retrieves only the tasks assigned to the current user.
   *
   * @returns Resolves with the user's assigned tasks.
   */
  public async getMyTasks(): Promise<any> {
    return this.get<any>('/user?fields=task&type=assignedTo');
  }

  /**
   * Retrieves only the bugs assigned to the current user.
   *
   * @returns Resolves with the user's assigned bugs.
   */
  public async getMyBugs(): Promise<any> {
    return this.get<any>('/user?fields=bug&type=assignedTo');
  }

  /**
   * Retrieves details of a specific task.
   * Checks the cache first, otherwise fetches from API.
   * Falls back to classic JSON API if REST API returns empty/invalid response.
   * 
   * @param taskId The ID of the task.
   * @returns Resolves with the task details.
   */
  public async getTaskDetails(taskId: string | number) {
    return this.getWithFallback(`/tasks/${taskId}`, 'task', taskId);
  }

  /**
   * Retrieves details of a specific bug.
   * Checks the cache first, otherwise fetches from API.
   * Falls back to classic JSON API if REST API returns empty/invalid response.
   * 
   * @param bugId The ID of the bug.
   * @returns Resolves with the bug details.
   */
  public async getBugDetails(bugId: string | number) {
    return this.getWithFallback(`/bugs/${bugId}`, 'bug', bugId);
  }

  /**
   * Downloads a file from Zentao API and pipes it to a local file path.
   * 
   * @param fileId The ID of the file to download.
   * @param targetPath The local file path where the file should be saved.
   * @returns A promise that resolves to the targetPath upon success, or rejects with an error.
   */
  public async downloadFile(fileId: string | number, targetPath: string): Promise<string> {
    const res = await this.client.get(`/files/${fileId}`, {
      responseType: 'stream',
    });
    return this.pipeStreamToFile(res.data, targetPath);
  }

  /**
   * Downloads an image from a full authenticated URL and saves it to a local path.
   * Uses the same authenticated Axios client so ZenTao session token is injected automatically.
   *
   * @param imageUrl The full image URL to download (e.g. https://zentao.../file-read-xxx.png).
   * @param targetPath The local file path where the image should be saved.
   * @returns A promise that resolves to the targetPath upon success, or rejects with an error.
   */
  public async downloadImageToLocal(imageUrl: string, targetPath: string): Promise<string> {
    const res = await this.client.get(imageUrl, {
      baseURL: '',        // override baseURL so the full URL is used as-is
      responseType: 'stream',
    });
    return this.pipeStreamToFile(res.data, targetPath);
  }

  /**
   * Helper method to perform POST requests.
   * Clears the cache to ensure subsequent GET requests fetch the updated state.
   * 
   * @param url The API endpoint path.
   * @param data The payload data.
   * @returns The response data.
   */
  public async post<T>(url: string, data?: any): Promise<T> {
    this.clearCache();
    const res = await this.client.post<T>(url, data);
    return res.data;
  }

  /**
   * Helper method to perform PUT requests.
   * Clears the cache to ensure subsequent GET requests fetch the updated state.
   *
   * @param url The API endpoint path.
   * @param data The payload data.
   * @returns The response data.
   */
  public async put<T>(url: string, data?: any): Promise<T> {
    this.clearCache();
    const res = await this.client.put<T>(url, data);
    return res.data;
  }

  /**
   * Creates a new task under the given execution.
   *
   * @param executionId The ID of the execution the task belongs to.
   * @param payload The task fields (e.g. name, type, assignedTo, estimate, pri, desc).
   * @returns The created task object returned by the API.
   */
  public async createTask(executionId: string | number, payload: any) {
    return this.post<any>(`/executions/${executionId}/tasks`, payload);
  }

  /**
   * Updates (edits) an existing task's fields.
   *
   * @param taskId The ID of the task to edit.
   * @param payload The task fields to change (only provided fields are sent).
   * @returns The updated task object returned by the API.
   */
  public async updateTask(taskId: string | number, payload: any) {
    return this.put<any>(`/tasks/${taskId}`, payload);
  }

  /**
   * Creates a new bug under the given product.
   *
   * @param productId The ID of the product the bug belongs to.
   * @param payload The bug fields (e.g. title, type, severity, pri, steps, assignedTo).
   * @returns The created bug object returned by the API.
   */
  public async createBug(productId: string | number, payload: any) {
    return this.post<any>(`/products/${productId}/bugs`, payload);
  }

  /**
   * Lists tasks under the given execution.
   *
   * @param executionId The ID of the execution the tasks belong to.
   * @returns Resolves with `{ total, tasks }` (or a raw list, normalised by caller).
   */
  public async listExecutionTasks(executionId: string | number): Promise<any> {
    return this.get<any>(`/executions/${executionId}/tasks`);
  }

  /**
   * Lists bugs under the given product.
   *
   * @param productId The ID of the product the bugs belong to.
   * @returns Resolves with `{ total, bugs }` (or a raw list, normalised by caller).
   */
  public async listProductBugs(productId: string | number): Promise<any> {
    return this.get<any>(`/products/${productId}/bugs`);
  }

  /**
   * Updates (edits) an existing bug's fields.
   *
   * @param bugId The ID of the bug to edit.
   * @param payload The bug fields to change (only provided fields are sent).
   * @returns The updated bug object returned by the API.
   */
  public async updateBug(bugId: string | number, payload: any) {
    return this.put<any>(`/bugs/${bugId}`, payload);
  }

  /**
   * Updates task status by calling the action endpoint.
   * 
   * @param taskId The ID of the task.
   * @param action The status transition action (e.g. 'start', 'finish', 'close', 'pause', 'cancel').
   * @param payload The request body payload.
   */
  public async updateTaskStatus(taskId: string | number, action: string, payload: any) {
    return this.post<any>(`/tasks/${taskId}/${action}`, payload);
  }

  /**
   * Updates bug status by calling the action endpoint.
   * 
   * @param bugId The ID of the bug.
   * @param action The status transition action (e.g. 'resolve', 'close', 'activate').
   * @param payload The request body payload.
   */
  public async updateBugStatus(bugId: string | number, action: string, payload: any) {
    return this.post<any>(`/bugs/${bugId}/${action}`, payload);
  }

  /**
   * Posts to a classic (non-REST) ZenTao action endpoint and normalizes the
   * result. Shared by `addComment`, `editComment`, and `deleteComment`, which
   * all rely on the legacy web action module rather than the REST API.
   *
   * @param actionPath     The action path without extension (e.g. `action-comment-task-123`).
   * @param params         The form-encoded body to send.
   * @param successMessage Message returned on success.
   * @throws {Error} If the response does not indicate success.
   */
  private async postClassicAction(
    actionPath: string,
    params: URLSearchParams,
    successMessage: string
  ): Promise<{ result: 'success'; message: string }> {
    if (!this.token) {
      await this.login();
    }

    const url = `${this.webBaseUrl}/${actionPath}.json?zentaosid=${this.token}`;

    // Clear the cache so subsequent fetches reflect the mutation.
    this.clearCache();

    const res = await this.client.post(url, params, {
      baseURL: '', // override baseURL
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (res.status === 200 && typeof res.data === 'string' && res.data.includes('reload')) {
      return { result: 'success', message: successMessage };
    }

    const responseData = typeof res.data === 'string' && res.data.startsWith('{') ? JSON.parse(res.data) : res.data;
    if (responseData && (responseData.status === 'success' || responseData.result === 'success')) {
      return { result: 'success', message: successMessage };
    }

    throw new Error(`Classic action '${actionPath}' failed. Response: ${typeof res.data === 'string' ? res.data.substring(0, 200) : JSON.stringify(res.data)}`);
  }

  /**
   * Adds a comment to a task or a bug using the classic action comment endpoint.
   *
   * @param type The object type ('task' or 'bug').
   * @param id The ID of the object.
   * @param comment The text of the comment to add.
   */
  public async addComment(type: 'task' | 'bug', id: string | number, comment: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('comment', comment);
    return this.postClassicAction(`action-comment-${type}-${id}`, params, 'Comment added successfully');
  }

  /**
   * Edits an existing comment (action record) by its action ID.
   * ZenTao's classic `editComment` endpoint expects the new text under the
   * `lastComment` field.
   *
   * @param actionId The action ID of the comment to edit (see `zentao_get_comments`).
   * @param comment  The new comment text.
   */
  public async editComment(actionId: string | number, comment: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('lastComment', comment);
    return this.postClassicAction(`action-editComment-${actionId}`, params, 'Comment updated successfully');
  }

  /**
   * Deletes a comment (action record) by hiding it from the timeline.
   * ZenTao has no hard-delete for comments; `hideOne` performs a soft delete
   * that can be restored from the trash by an admin.
   *
   * @param actionId The action ID of the comment to delete (see `zentao_get_comments`).
   */
  public async deleteComment(actionId: string | number): Promise<any> {
    return this.postClassicAction(`action-hideOne-${actionId}`, new URLSearchParams(), 'Comment deleted (hidden) successfully');
  }
}

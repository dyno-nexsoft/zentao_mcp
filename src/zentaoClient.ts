import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

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
  /** Fix #3: In-flight request map prevents cache stampede under concurrent calls. */
  private inFlightRequests = new Map<string, Promise<any>>();

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

    // Fix #3: If a request for this URL is already in-flight, reuse its promise
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

  /**
   * Initializes the Axios client with base configurations and registers interceptors
   * to automatically inject token headers and handle token expiration (401 errors).
   * 
   * @param customClient Optional custom AxiosInstance for dependency injection/testing.
   */
  constructor(customClient?: AxiosInstance) {
    this.client = customClient || axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
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

  /**
   * Retrieves details of a specific task.
   * Checks the cache first, otherwise fetches from API.
   * 
   * @param taskId The ID of the task.
   * @returns Resolves with the task details.
   */
  public async getTaskDetails(taskId: string | number) {
    return this.get<any>(`/tasks/${taskId}`);
  }

  /**
   * Retrieves details of a specific bug.
   * Checks the cache first, otherwise fetches from API.
   * 
   * @param bugId The ID of the bug.
   * @returns Resolves with the bug details.
   */
  public async getBugDetails(bugId: string | number) {
    return this.get<any>(`/bugs/${bugId}`);
  }

  /**
   * Downloads a file from Zentao API and pipes it to a local file path.
   * 
   * @param fileId The ID of the file to download.
   * @param targetPath The local file path where the file should be saved.
   * @returns A promise that resolves to the targetPath upon success, or rejects with an error.
   */
  public async downloadFile(fileId: string | number, targetPath: string): Promise<string> {
    const writer = fs.createWriteStream(targetPath);
    const res = await this.client.get(`/files/${fileId}`, {
      responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
      res.data.pipe(writer);
      let error: Error | null = null;
      writer.on('error', (err) => {
        error = err;
        writer.close();
        // Fix #4: remove the partial/corrupt file so future calls don't mistake it for a valid download.
        fs.unlink(targetPath, () => { /* best-effort cleanup */ });
        reject(err);
      });
      writer.on('close', () => {
        if (!error) resolve(targetPath);
      });
    });
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
    const writer = fs.createWriteStream(targetPath);
    const res = await this.client.get(imageUrl, {
      baseURL: '',        // override baseURL so the full URL is used as-is
      responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
      res.data.pipe(writer);
      let error: Error | null = null;
      writer.on('error', (err) => {
        error = err;
        writer.close();
        // Fix #4: remove the partial/corrupt file so future calls don't mistake it for a valid download.
        fs.unlink(targetPath, () => { /* best-effort cleanup */ });
        reject(err);
      });
      writer.on('close', () => {
        if (!error) resolve(targetPath);
      });
    });
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
}

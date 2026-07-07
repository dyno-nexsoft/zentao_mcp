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

  /**
   * Initializes the Axios client with base configurations and registers interceptors
   * to automatically inject token headers and handle token expiration (401 errors).
   */
  constructor() {
    this.client = axios.create({
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
    try {
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
    } catch (error: any) {
      console.error('Failed to login to Zentao:', error.message);
      throw error;
    }
  }

  /**
   * Retrieves a list of users from the Zentao instance.
   * 
   * @param page The page number to retrieve. Defaults to 1.
   * @param limit The number of user items to retrieve per page. Defaults to 100.
   * @returns Resolves with the response data from the API.
   */
  public async getUsers(page: number = 1, limit: number = 100) {
    const res = await this.client.get(`/users?page=${page}&limit=${limit}`);
    return res.data;
  }

  /**
   * Retrieves all projects from the Zentao instance.
   * 
   * @returns Resolves with the list of projects data.
   */
  public async getProjects() {
    const res = await this.client.get('/projects');
    return res.data;
  }

  /**
   * Retrieves executions (sprints/stages) associated with a specific project.
   * 
   * @param projectId The ID of the parent project.
   * @returns Resolves with the project's executions data.
   */
  public async getProjectExecutions(projectId: string | number) {
    const res = await this.client.get(`/projects/${projectId}/executions`);
    return res.data;
  }

  /**
   * Retrieves details of a specific execution.
   * 
   * @param executionId The ID of the execution.
   * @returns Resolves with the execution's detailed info.
   */
  public async getExecutionDetails(executionId: string | number) {
    const res = await this.client.get(`/executions/${executionId}`);
    return res.data;
  }

  /**
   * Retrieves tasks for a specific execution, with optional filters.
   * 
   * @param executionId The ID of the execution (sprint).
   * @param page The page number to retrieve. Defaults to 1.
   * @param limit The maximum number of tasks to return. Defaults to 500.
   * @param moduleId Optional ID of the module to filter tasks by.
   * @returns Resolves with the execution tasks data.
   */
  public async getExecutionTasks(executionId: string | number, page: number = 1, limit: number = 500, moduleId?: string | number) {
    let url = `/executions/${executionId}/tasks?page=${page}&limit=${limit}`;
    if (moduleId) {
      url += `&moduleID=${moduleId}`;
    }
    const res = await this.client.get(url);
    return res.data;
  }

  /**
   * Retrieves details of a specific task.
   * 
   * @param taskId The ID of the task.
   * @returns Resolves with the task details.
   */
  public async getTaskDetails(taskId: string | number) {
    const res = await this.client.get(`/tasks/${taskId}`);
    return res.data;
  }

  /**
   * Retrieves task modules for a specific execution.
   * 
   * @param executionId The ID of the execution.
   * @returns Resolves with the module taxonomy data.
   */
  public async getTaskModules(executionId: string | number) {
    const res = await this.client.get(`/modules?type=task&id=${executionId}`);
    return res.data;
  }

  /**
   * Retrieves bugs associated with a specific product.
   * 
   * @param productId The ID of the product.
   * @returns Resolves with the product bugs data.
   */
  public async getProductBugs(productId: string | number) {
    const res = await this.client.get(`/products/${productId}/bugs`);
    return res.data;
  }

  /**
   * Retrieves details of a specific bug.
   * 
   * @param bugId The ID of the bug.
   * @returns Resolves with the bug details.
   */
  public async getBugDetails(bugId: string | number) {
    const res = await this.client.get(`/bugs/${bugId}`);
    return res.data;
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
      writer.on('error', err => {
        error = err;
        writer.close();
        reject(err);
      });
      writer.on('close', () => {
        if (!error) {
          resolve(targetPath);
        }
      });
    });
  }
}

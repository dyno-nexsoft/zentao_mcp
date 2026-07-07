import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

export class ZentaoClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private account = process.env.ZENTAO_ACCOUNT || '';
  private password = process.env.ZENTAO_PASSWORD || '';
  private baseUrl = process.env.ZENTAO_BASE_URL || '';

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

  public async getUsers(page: number = 1, limit: number = 100) {
    const res = await this.client.get(`/users?page=${page}&limit=${limit}`);
    return res.data;
  }

  public async getProjects() {
    const res = await this.client.get('/projects');
    return res.data;
  }

  public async getProjectExecutions(projectId: string | number) {
    const res = await this.client.get(`/projects/${projectId}/executions`);
    return res.data;
  }

  public async getExecutionDetails(executionId: string | number) {
    const res = await this.client.get(`/executions/${executionId}`);
    return res.data;
  }

  public async getExecutionTasks(executionId: string | number, page: number = 1, limit: number = 500, moduleId?: string | number) {
    let url = `/executions/${executionId}/tasks?page=${page}&limit=${limit}`;
    if (moduleId) {
      url += `&moduleID=${moduleId}`;
    }
    const res = await this.client.get(url);
    return res.data;
  }

  public async getTaskModules(executionId: string | number) {
    const res = await this.client.get(`/modules?type=task&id=${executionId}`);
    return res.data;
  }

  public async getProductBugs(productId: string | number) {
    const res = await this.client.get(`/products/${productId}/bugs`);
    return res.data;
  }

  public async getBugDetails(bugId: string | number) {
    const res = await this.client.get(`/bugs/${bugId}`);
    return res.data;
  }
}

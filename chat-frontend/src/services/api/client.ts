import { ApiResponse, ApiError, isApiError } from '@castironforge/shared-types'

export interface ApiClientConfig {
  baseUrl: string
  authToken: string
  timeout?: number
}

export class ApiClient {
  private config: ApiClientConfig

  constructor(config: ApiClientConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    }
  }

  async post<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request('POST', endpoint, body)
  }

  async get<T = unknown>(endpoint: string): Promise<T> {
    return this.request('GET', endpoint)
  }

  private async request<T = unknown>(method: string, endpoint: string, body?: unknown): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.authToken}`,
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeout || 30000)

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      const data = (await response.json()) as ApiResponse<T> | ApiError

      if (!response.ok) {
        if (isApiError(data)) {
          throw new Error(`${data.error.code}: ${data.error.message}`)
        }
        throw new Error(`HTTP ${response.status}`)
      }

      if (isApiError(data)) {
        throw new Error(`${data.error.code}: ${data.error.message}`)
      }

      return (data as ApiResponse<T>).data as T
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function createApiClient(baseUrl: string, authToken: string): ApiClient {
  return new ApiClient({ baseUrl, authToken })
}

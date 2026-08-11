/**
 * API Service
 * Handles all HTTP communication with the backend
 * Implements security best practices and proper error handling
 */

import config from './config';

/**
 * Custom API Error class
 */
export class APIError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number, code: string = 'API_ERROR') {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * API Response interface
 */
interface APIResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Request options interface
 */
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Create an AbortController with timeout
 */
const createTimeoutController = (timeoutMs: number): { controller: AbortController; timeoutId: number } => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
};

/**
 * Make an HTTP request to the backend API
 * @param endpoint - API endpoint path
 * @param options - Request options
 * @returns Promise with response data
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    timeout = config.timeout,
  } = options;

  const url = `${config.apiUrl}${endpoint}`;
  const { controller, timeoutId } = createTimeoutController(timeout);

  try {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const token = localStorage.getItem('btc-auth-token');
    if (token && !requestHeaders['Authorization']) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      signal: controller.signal,
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);
    
    // Clear timeout on successful response
    clearTimeout(timeoutId);

    // Parse response
    let data: APIResponse<T>;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      throw new APIError('Invalid response format from server', 500, 'INVALID_RESPONSE');
    }

    // Handle error responses
    if (!response.ok) {
      throw new APIError(
        data.error?.message || `Request failed with status ${response.status}`,
        response.status,
        data.error?.code || 'API_ERROR'
      );
    }

    // Handle API-level errors
    if (!data.success && data.error) {
      throw new APIError(
        data.error.message,
        response.status,
        data.error.code
      );
    }

    return data.data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof APIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new APIError('Request timeout - server took too long to respond', 408, 'TIMEOUT');
      }
      
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new APIError(
          'Unable to connect to server. Please check if the backend is running.',
          503,
          'CONNECTION_ERROR'
        );
      }

      throw new APIError(error.message, 500, 'UNKNOWN_ERROR');
    }

    throw new APIError('An unexpected error occurred', 500, 'UNKNOWN_ERROR');
  }
}

/**
 * API methods
 */
export const api = {
  /**
   * GET request
   */
  get: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  /**
   * POST request
   */
  post: <T>(endpoint: string, body?: Record<string, unknown>, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  /**
   * PUT request
   */
  put: <T>(endpoint: string, body?: Record<string, unknown>, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  /**
   * DELETE request
   */
  delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};

export default api;

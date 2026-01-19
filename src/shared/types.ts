export interface BulkerSettings {
  followRedirects: boolean;
  threads: number;
  randomUserAgent: boolean;
  httpMethod: string;
  timeout: number;
  retryCount: number;
  customHeaders: [string, string][];
  customQueryParams: [string, string][];
}

export interface BulkerResult {
  id: string;
  url: string;
  method: string;
  status: number;
  length: number;
  duration: number;
  error?: string;
  requestId?: string;
  timestamp: number;
  contentType?: string;
}

export interface RequestDetails {
  request: string;
  response: string;
  contentType?: string;
  host: string;
  port: number;
  tls: boolean;
}

// Backend API - functions callable from frontend
export interface BackendAPI {
  sendBulkRequests(urls: string[], settings: BulkerSettings): Promise<BulkerResult[]>;
  cancelExecution(): Promise<void>;
  getSettings(): Promise<BulkerSettings>;
  updateSettings(settings: BulkerSettings): Promise<void>;
  getResults(): Promise<BulkerResult[]>;
  clearResults(): Promise<void>;
  getRequestUrls(ids: string[]): Promise<string[]>;
  getRequestDetails(id: string): Promise<RequestDetails | null>;
}

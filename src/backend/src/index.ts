/// <reference types="@caido/sdk-backend" />

import type { APISDK, SDK } from "caido:plugin";
import { RequestSpec } from "caido:utils";
import { BulkerSettings, BulkerResult, BackendAPI } from "../../shared/types";
import { SettingsStore, DEFAULT_SETTINGS } from "./settings";

const settingsStore = new SettingsStore();
let resultsCache: BulkerResult[] = [];
let isCancelled = false;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
];

async function sendSingleRequest(
  sdk: SDK,
  url: string,
  settings: BulkerSettings
): Promise<BulkerResult> {
  const startTime = Date.now();

  try {
    // Parse URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      throw new Error(`Invalid URL: ${url}`);
    }

    const host = parsedUrl.hostname;
    const isTls = parsedUrl.protocol === "https:";
    const port = parsedUrl.port ? parseInt(parsedUrl.port) : (isTls ? 443 : 80);
    let path = parsedUrl.pathname || "/";

    // Add query params from URL
    if (parsedUrl.search) {
      path += parsedUrl.search;
    }

    // Add custom query parameters
    if (settings.customQueryParams && settings.customQueryParams.length > 0) {
      const params = new URLSearchParams(parsedUrl.search);
      for (const [name, value] of settings.customQueryParams) {
        params.append(name, value);
      }
      const queryString = params.toString();
      path = parsedUrl.pathname + (queryString ? "?" + queryString : "");
    }

    // Build RequestSpec
    const spec = new RequestSpec(url);
    spec.setHost(host);
    spec.setPort(port);
    spec.setTls(isTls);
    spec.setPath(path);
    spec.setMethod(settings.httpMethod);

    // Set User-Agent
    const userAgent = settings.randomUserAgent
      ? USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
      : USER_AGENTS[0];
    spec.setHeader("User-Agent", userAgent);

    // Set custom headers
    if (settings.customHeaders) {
      for (const [name, value] of settings.customHeaders) {
        spec.setHeader(name, value);
      }
    }

    sdk.console.log(`[Bulker] Sending ${settings.httpMethod} to ${host}:${port}${path}`);

    // Send request
    const response = await sdk.requests.send(spec, {
      timeouts: (settings.timeout || 30) * 1000,
      save: true
    });

    const duration = Date.now() - startTime;
    const statusCode = response.response.getCode();
    const bodyLength = response.response.getBody()?.length || 0;
    const requestId = response.request.getId();
    
    // Extract Content-Type
    const contentTypeHeader = response.response.getHeader("Content-Type");
    const contentType = contentTypeHeader && contentTypeHeader.length > 0 ? contentTypeHeader[0] : undefined;

    sdk.console.log(`[Bulker] Response: ${statusCode} (${bodyLength} bytes, ${duration}ms)`);

    return {
      id: crypto.randomUUID(),
      url,
      method: settings.httpMethod,
      status: statusCode,
      length: bodyLength,
      duration,
      requestId,
      timestamp: Date.now(),
      contentType
    };
  } catch (error: any) {
    sdk.console.error(`[Bulker] Request failed for ${url}: ${error.message}`);
    return {
      id: crypto.randomUUID(),
      url,
      method: settings.httpMethod,
      status: 0,
      length: 0,
      duration: Date.now() - startTime,
      error: error.message || "Unknown error",
      timestamp: Date.now()
    };
  }
}

async function executeBulkRequests(
  sdk: SDK,
  urls: string[],
  settings: BulkerSettings
): Promise<BulkerResult[]> {
  isCancelled = false;
  const results: BulkerResult[] = [];

  const concurrency = Math.min(settings.threads || 20, 50);
  sdk.console.log(`[Bulker] Starting execution: ${urls.length} URLs with ${concurrency} concurrent workers`);

  // Process URLs with concurrency control
  const queue = [...urls];
  const executing: Promise<void>[] = [];

  const processNext = async () => {
    while (queue.length > 0 && !isCancelled) {
      const url = queue.shift();
      if (!url) break;

      const result = await sendSingleRequest(sdk, url.trim(), settings);
      results.push(result);
      resultsCache.push(result);
    }
  };

  // Start workers
  for (let i = 0; i < concurrency; i++) {
    executing.push(processNext());
  }

  await Promise.all(executing);

  sdk.console.log(`[Bulker] Execution complete. ${results.length} results.`);
  return results;
}

export async function init(sdk: SDK) {
  const api = sdk.api as APISDK<BackendAPI, Record<string, never>>;

  api.register("sendBulkRequests", async (sdkInstance: SDK, urls: string[], settings: BulkerSettings) => {
    sdkInstance.console.log(`[Bulker] API: sendBulkRequests called for ${urls.length} URLs`);
    const results = await executeBulkRequests(sdkInstance, urls, settings);
    return results;
  });

  api.register("cancelExecution", async (sdkInstance: SDK) => {
    sdkInstance.console.log("[Bulker] API: cancelExecution called");
    isCancelled = true;
  });

  api.register("getSettings", async () => {
    return settingsStore.getSettings();
  });

  api.register("updateSettings", async (sdkInstance: SDK, settings: BulkerSettings) => {
    settingsStore.updateSettings(settings);
  });

  api.register("getResults", async () => {
    return resultsCache;
  });

  api.register("clearResults", async () => {
    resultsCache = [];
  });

  api.register("getRequestUrls", async (sdkInstance: SDK, ids: string[]) => {
    const urls: string[] = [];
    for (const id of ids) {
      try {
        const record = await sdkInstance.requests.get(id);
        if (record?.request) {
          urls.push(record.request.getUrl());
        }
      } catch (err: any) {
        sdkInstance.console.warn(`[Bulker] Failed to get URL for request ${id}: ${err.message}`);
      }
    }
    return urls;
  });

  api.register("getRequestDetails", async (sdkInstance: SDK, id: string) => {
    try {
      const record = await sdkInstance.requests.get(id);
      if (!record) return null;
      
      const contentTypeHeader = record.response?.getHeader("Content-Type");
      const contentType = contentTypeHeader && contentTypeHeader.length > 0 ? contentTypeHeader[0] : undefined;
      
      return {
        request: record.request.getRaw().toText(),
        response: record.response?.getRaw().toText() || "",
        contentType,
        host: record.request.getHost(),
        port: record.request.getPort(),
        tls: record.request.getTls()
      };
    } catch (err: any) {
      sdkInstance.console.error(`[Bulker] Failed to get request details for ${id}: ${err.message}`);
      return null;
    }
  });

  sdk.console.log("[Bulker] Backend initialized.");
}

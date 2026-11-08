import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMClientOptions {
  apiKey: string;
  baseUrl: string;
  modelId: string;
}

interface ChatStreamOptions {
  messages: LLMMessage[];
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onChunk: (chunk: string) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
}

/**
 * Trusted hostnames for the LLM API provider.
 * Only these hosts may be used as the API base URL — this prevents SSRF
 * attacks from a user-configurable baseUrl field.
 */
const TRUSTED_HOSTS = new Set([
  'api.llmapi.ai',
  'api.openai.com',
  'api.anthropic.com'
]);

/**
 * Loopback addresses that are permitted to use plain HTTP.
 * Local gateways (e.g. a FreeLLM API proxy on 127.0.0.1) need this
 * because they serve over http:// inside the trusted machine.
 *
 * Note: IPv6 addresses in URLs appear with brackets (e.g. [::1]),
 * so we check both the bracketed and unbracketed forms.
 */
const LOOPBACK_HOSTS = new Set([
  '127.0.0.1',
  'localhost',
  '::1',
  '[::1]'
]);

/**
 * Validate that a base URL is safe to use for outbound API requests.
 *
 * - HTTPS is required for all non-loopback addresses.
 * - HTTP is permitted ONLY for loopback addresses (127.0.0.1, localhost, ::1).
 * - file://, javascript:// and other unsafe protocols are rejected.
 * - Non-trusted hosts are rejected.
 * - The validated URL (including pathname, e.g. /v1) is returned so that
 *   request paths are constructed correctly.
 */
export function validateBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid base URL: could not be parsed.');
  }

  // Reject unsafe protocols entirely.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(
      `Invalid base URL: protocol "${url.protocol}" is not allowed. ` +
      `Only HTTPS is permitted for remote hosts, and HTTP only for local loopback.`
    );
  }

  const isLoopback = LOOPBACK_HOSTS.has(url.hostname);

  // HTTP is only allowed for loopback addresses.
  if (url.protocol === 'http:' && !isLoopback) {
    throw new Error(
      'Invalid base URL: only HTTPS is allowed for non-loopback addresses. ' +
      `HTTP is permitted only for local hosts (${Array.from(LOOPBACK_HOSTS).join(', ')}).`
    );
  }

  // HTTPS is required for all non-loopback addresses.
  if (url.protocol === 'https:' && !isLoopback && !TRUSTED_HOSTS.has(url.hostname)) {
    throw new Error(
      `Untrusted API host "${url.hostname}". ` +
      `Allowed hosts: ${Array.from(TRUSTED_HOSTS).join(', ')}`
    );
  }

  // Return full validated URL including pathname (e.g. /v1), without trailing slash.
  return url.origin + url.pathname.replace(/\/$/, '');
}

/**
 * Return the appropriate Node http module for the given validated URL.
 * Loopback addresses use plain http; everything else uses https.
 */
function httpModuleFor(url: URL): typeof http | typeof https {
  return LOOPBACK_HOSTS.has(url.hostname) ? http : https;
}

const activeControllers = new Set<AbortController>();

export class LLMClient {
  private apiKey: string;
  private baseUrl: string;
  private modelId: string;

  constructor(opts: LLMClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = validateBaseUrl(opts.baseUrl).replace(/\/$/, '');
    this.modelId = opts.modelId;
  }

  static stopAll(): void {
    for (const c of activeControllers) {
      try { c.abort(); } catch {}
    }
    activeControllers.clear();
  }

  /**
   * Single HTTP request implementation used by both the connection test
   * and the streaming chat endpoint.
   */
  private request(
    endpoint: string,
    body: any,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<any> {
    const url = new URL(this.baseUrl + endpoint);
    const data = body ? JSON.stringify(body) : undefined;
    const mod = httpModuleFor(url);

    return new Promise((resolve, reject) => {
      const req = mod.request(
        {
          hostname: url.hostname,
          port: url.port || (mod === https ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
          }
        },
        (res) => {
          let raw = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => { raw += chunk; });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              let msg = `HTTP ${res.statusCode}`;
              try {
                const parsed = JSON.parse(raw);
                msg = parsed?.error?.message || parsed?.message || msg;
              } catch {}
              return reject(new Error(msg));
            }
            try {
              resolve(JSON.parse(raw));
            } catch {
              resolve(raw);
            }
          });
        }
      );

      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  async testConnection(): Promise<{ modelId: string; latencyMs: number }> {
    const start = Date.now();
    // Lightweight probe: list models endpoint (OpenAI-compatible GET).
    await this.request('/models', undefined, 'GET');
    const latencyMs = Date.now() - start;
    return { modelId: this.modelId, latencyMs };
  }

  async chatStream(opts: ChatStreamOptions): Promise<void> {
    const {
      messages,
      modelId,
      temperature = 0.7,
      maxTokens = 4096,
      signal,
      onChunk,
      onError,
      onComplete
    } = opts;

    const body: any = {
      model: modelId || this.modelId,
      messages,
      temperature,
      stream: true
    };
    if (maxTokens) body.max_tokens = maxTokens;

    const url = new URL(this.baseUrl + '/chat/completions');
    const data = JSON.stringify(body);
    const mod = httpModuleFor(url);

    const controller = new AbortController();
    activeControllers.add(controller);
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      activeControllers.delete(controller);
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      controller.abort();
      cleanup();
      onError(new Error('Generation stopped'));
    };

    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }

    return new Promise((resolve) => {
      const req = mod.request(
        {
          hostname: url.hostname,
          port: url.port || (mod === https ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            'Content-Length': Buffer.byteLength(data)
          }
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            let raw = '';
            res.setEncoding('utf8');
            res.on('data', (c) => { raw += c; });
            res.on('end', () => {
              cleanup();
              let msg = `HTTP ${res.statusCode}`;
              try {
                const parsed = JSON.parse(raw);
                msg = parsed?.error?.message || parsed?.message || msg;
              } catch {}
              onError(new Error(msg));
              resolve();
            });
            return;
          }

          res.setEncoding('utf8');
          let buffer = '';

          const processLine = (line: string) => {
            if (!line.startsWith('data:')) return;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') return;
            try {
              const json = JSON.parse(payload);
              const delta = json?.choices?.[0]?.delta?.content;
              if (delta) onChunk(delta);
            } catch {
              // Ignore malformed SSE lines.
            }
          };

          res.on('data', (chunk: string) => {
            buffer += chunk;
            let idx: number;
            while ((idx = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, idx).replace(/\r$/, '');
              buffer = buffer.slice(idx + 1);
              processLine(line);
            }
          });

          res.on('end', () => {
            if (buffer.trim()) processLine(buffer);
            cleanup();
            onComplete();
            resolve();
          });
        }
      );

      req.on('error', (err) => {
        cleanup();
        onError(err instanceof Error ? err : new Error(String(err)));
        resolve();
      });

      req.write(data);
      req.end();
    });
  }
}
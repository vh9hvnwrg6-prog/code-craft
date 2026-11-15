import { app, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';
import { validateBaseUrl } from './client';

export interface LLMConfig {
  provider: string;
  apiKey: string;
  modelId: string;
  baseUrl: string;
}

const CONFIG_FILE = path.join(app.getPath('userData'), 'llm-config.json');

function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

/**
 * Encrypt a secret value using Electron safeStorage.
 * safeStorage is required — there is no plaintext fallback, because
 * storing secrets unencrypted would defeat the purpose of this store.
 */
function encrypt(plain: string): string {
  if (!isEncryptionAvailable()) {
    throw new Error(
      'Electron safeStorage is unavailable on this system. ' +
      'API keys cannot be stored securely.'
    );
  }
  const buf = safeStorage.encryptString(plain);
  return buf.toString('base64');
}

function decrypt(encoded: string): string {
  if (!isEncryptionAvailable()) {
    throw new Error(
      'Electron safeStorage is unavailable on this system. ' +
      'Cannot decrypt stored API key.'
    );
  }
  const buf = Buffer.from(encoded, 'base64');
  return safeStorage.decryptString(buf);
}

export class ConfigStore {
  private config: LLMConfig | null = null;

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(CONFIG_FILE)) return;
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as {
        provider: string;
        apiKey: string;
        modelId: string;
        baseUrl: string;
      };
      if (raw && raw.apiKey) {
        this.config = {
          provider: raw.provider || 'LLM API',
          apiKey: decrypt(raw.apiKey),
          modelId: raw.modelId || '',
          baseUrl: raw.baseUrl || 'https://api.llmapi.ai/v1'
        };
      }
    } catch (err) {
      console.error('[ConfigStore] Failed to load config:', err);
    }
  }

  save(cfg: LLMConfig): void {
    // Validate the base URL through the same security checks used by the
    // LLM client so an unsafe URL cannot be persisted here.
    const validatedUrl = validateBaseUrl(cfg.baseUrl);
    const encrypted = encrypt(cfg.apiKey);
    const data = {
      provider: cfg.provider,
      apiKey: encrypted,
      modelId: cfg.modelId,
      baseUrl: validatedUrl
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    this.config = { ...cfg, baseUrl: validatedUrl };
  }

  get(): LLMConfig | null {
    return this.config ? { ...this.config } : null;
  }

  getSafe(): Omit<LLMConfig, 'apiKey'> & { hasApiKey: boolean; encryptionAvailable: boolean } {
    return {
      provider: this.config?.provider || 'LLM API',
      modelId: this.config?.modelId || '',
      baseUrl: this.config?.baseUrl || 'https://api.llmapi.ai/v1',
      hasApiKey: !!this.config?.apiKey,
      encryptionAvailable: isEncryptionAvailable()
    };
  }

  clear(): void {
    this.config = null;
    try {
      if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
    } catch (err) {
      console.error('[ConfigStore] Failed to clear config:', err);
    }
  }
}
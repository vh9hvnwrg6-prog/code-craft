import React, { useEffect, useState } from 'react';
import {
  Key,
  Server,
  Cpu,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Plug
} from 'lucide-react';

interface LLMConfig {
  provider: string;
  modelId: string;
  baseUrl: string;
  hasApiKey: boolean;
  encryptionAvailable: boolean;
}

const DEFAULT_BASE_URL = 'https://api.llmapi.ai/v1';

export function AISettings({ onClose, onSave }: { onClose: () => void; onSave?: () => void }) {
  const [provider, setProvider] = useState('LLM API');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (window as any).electronAPI.llmGetConfig().then((cfg: LLMConfig) => {
      if (!mounted) return;
      setProvider(cfg.provider || 'LLM API');
      setModelId(cfg.modelId || '');
      setBaseUrl(cfg.baseUrl || DEFAULT_BASE_URL);
    });
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('API key is required.');
      return;
    }
    setSaving(true);
    setError('');
    setStatus('idle');
    setStatusMsg('');
    try {
      await (window as any).electronAPI.llmSaveConfig({
        provider,
        apiKey: apiKey.trim(),
        modelId: modelId.trim(),
        baseUrl: baseUrl.trim()
      });
      setApiKey('');
      setStatus('success');
      setStatusMsg('Configuration saved securely.');
      onSave?.();
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err?.message ?? 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError('');
    setStatus('idle');
    setStatusMsg('');
    try {
      const result = await (window as any).electronAPI.llmTestConnection();
      if (result.ok) {
        setStatus('success');
        setStatusMsg(`Connected — latency ${result.latencyMs} ms`);
      } else {
        setStatus('error');
        setStatusMsg(result.error ?? 'Connection failed.');
      }
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err?.message ?? 'Connection failed.');
    } finally {
      setTesting(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Remove the saved API key? This cannot be undone.')) return;
    try {
      await (window as any).electronAPI.llmClearConfig();
      setApiKey('');
      setModelId('');
      setBaseUrl(DEFAULT_BASE_URL);
      setStatus('idle');
      setStatusMsg('Configuration cleared.');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to clear configuration.');
    }
  };

  return (
    <div className="ai-settings">
      <div className="ai-settings-header">
        <div className="ai-settings-title">
          <Cpu size={16} />
          <span>AI SETTINGS</span>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close">
          <XCircle size={14} />
        </button>
      </div>

      <div className="ai-settings-body">
        <div className="ai-field">
          <label className="ai-label">
            <Server size={12} />
            <span>PROVIDER</span>
          </label>
          <input
            className="ai-input"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="LLM API"
          />
        </div>

        <div className="ai-field">
          <label className="ai-label">
            <Key size={12} />
            <span>API KEY</span>
          </label>
          <div className="ai-input-row">
            <input
              className="ai-input"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiKey ? '••••••••' : 'sk-...'}
              autoFocus
            />
            <button
              className="icon-btn"
              onClick={() => setShowKey(!showKey)}
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <span className="ai-hint">
            Stored locally and encrypted with Electron safeStorage. Never shared.
          </span>
        </div>

        <div className="ai-field">
          <label className="ai-label">
            <Plug size={12} />
            <span>BASE URL</span>
          </label>
          <input
            className="ai-input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={DEFAULT_BASE_URL}
          />
        </div>

        <div className="ai-field">
          <label className="ai-label">
            <Cpu size={12} />
            <span>MODEL ID</span>
          </label>
          <input
            className="ai-input"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="e.g. gpt-4o"
          />
          <span className="ai-hint">
            Enter the exact model ID supported by your account.
          </span>
        </div>

        {error && <div className="ai-error">{error}</div>}

        {status === 'success' && (
          <div className="ai-success">
            <CheckCircle2 size={14} />
            <span>{statusMsg}</span>
          </div>
        )}
        {status === 'error' && (
          <div className="ai-error">
            <XCircle size={14} />
            <span>{statusMsg}</span>
          </div>
        )}

        <div className="ai-actions">
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} />
            <span>{saving ? 'Saving…' : 'Save Configuration'}</span>
          </button>
          <button className="btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 size={14} className="spin" /> : <Plug size={14} />}
            <span>{testing ? 'Testing…' : 'Test Connection'}</span>
          </button>
          <button className="btn-danger" onClick={handleClear}>
            <Trash2 size={14} />
            <span>Clear</span>
          </button>
        </div>
      </div>
    </div>
  );
}
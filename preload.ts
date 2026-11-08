import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // LLM config (safe — never returns the API key)
  llmGetConfig: () => ipcRenderer.invoke('llm:get-config'),
  llmSaveConfig: (config: { provider: string; apiKey: string; modelId: string; baseUrl: string }) =>
    ipcRenderer.invoke('llm:save-config', config),
  llmClearConfig: () => ipcRenderer.invoke('llm:clear-config'),
  llmTestConnection: () => ipcRenderer.invoke('llm:test-connection'),

  // Chat streaming
  llmChatStream: (opts: { messages: any[]; modelId?: string }) =>
    ipcRenderer.invoke('llm:chat-stream', opts),
  llmStopGeneration: () => ipcRenderer.invoke('llm:stop-generation'),

  // Window controls
  windowControl: (action: 'close' | 'minimize' | 'maximize') =>
    ipcRenderer.invoke('window:control', action),

  // Streaming listeners — each returns an unsubscribe function
  // that removes ONLY the listener it created.
  onChatStart: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('llm:chat-start', handler);
    return () => ipcRenderer.removeListener('llm:chat-start', handler);
  },
  onChatChunk: (cb: (chunk: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, chunk: string) => cb(chunk);
    ipcRenderer.on('llm:chat-chunk', handler);
    return () => ipcRenderer.removeListener('llm:chat-chunk', handler);
  },
  onChatDone: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('llm:chat-done', handler);
    return () => ipcRenderer.removeListener('llm:chat-done', handler);
  },
  onChatError: (cb: (err: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, err: string) => cb(err);
    ipcRenderer.on('llm:chat-error', handler);
    return () => ipcRenderer.removeListener('llm:chat-error', handler);
  }
});
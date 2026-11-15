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
  },

  // File system operations (all I/O happens in the main process)
  fsReadFile: (filePath: string) => ipcRenderer.invoke('fs:read-file', filePath),
  fsWriteFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:write-file', filePath, content),
  fsOpenFolder: () => ipcRenderer.invoke('fs:open-folder'),
  fsCreateFile: (parentDir: string, fileName: string) => ipcRenderer.invoke('fs:create-file', parentDir, fileName),
  fsCreateFolder: (parentDir: string, folderName: string) => ipcRenderer.invoke('fs:create-folder', parentDir, folderName),
  fsDelete: (fullPath: string) => ipcRenderer.invoke('fs:delete', fullPath),
  fsRename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
  fsGetRecent: () => ipcRenderer.invoke('fs:get-recent'),
  fsAddRecent: (folderPath: string) => ipcRenderer.invoke('fs:add-recent', folderPath),
  fsRefreshTree: () => ipcRenderer.invoke('fs:refresh-tree'),
  memoryAdd: (entry: any) => ipcRenderer.invoke('memory:add', entry),
  memoryList: () => ipcRenderer.invoke('memory:list'),
  memorySearch: (query: string) => ipcRenderer.invoke('memory:search', query),
  memoryUpdate: (id: string, patch: any) => ipcRenderer.invoke('memory:update', id, patch),
  memoryRemove: (id: string) => ipcRenderer.invoke('memory:remove', id),
  memoryClear: () => ipcRenderer.invoke('memory:clear'),

  // CodeCraft project vault (~/Documents/CodeCraft)
  fsOpenVault: () => ipcRenderer.invoke('fs:open-vault'),
  fsCreateProject: (projectName: string) => ipcRenderer.invoke('fs:create-project', projectName),
  fsGetVaultPath: () => ipcRenderer.invoke('fs:get-vault-path'),

  // Attachments
  attachmentsOpenDialog: () => ipcRenderer.invoke('attachments:open-dialog'),
  attachmentsProcess: (filePaths: string[]) => ipcRenderer.invoke('attachments:process', filePaths),

  // First-run onboarding
  onboardingGet: () => ipcRenderer.invoke('onboarding:get'),
  onboardingSetName: (name: string) => ipcRenderer.invoke('onboarding:set-name', name),
  onboardingSetPreferences: (prefs: any) => ipcRenderer.invoke('onboarding:set-preferences', prefs),
  onboardingComplete: () => ipcRenderer.invoke('onboarding:complete'),
  onboardingReset: () => ipcRenderer.invoke('onboarding:reset'),

  // Import existing Claude Code sessions from ~/.claude/projects
  claudeImportSessions: () => ipcRenderer.invoke('claude:import-sessions'),

  // Claude Code CLI Integration
  claudeCheckAvailability: () => ipcRenderer.invoke('claude:check-availability'),
  claudeAuthStatus: () => ipcRenderer.invoke('claude:auth-status'),
  claudeTestConnection: () => ipcRenderer.invoke('claude:test-connection'),
  claudeRunStream: (options: {
    prompt: string;
    cwd?: string;
    sessionId?: string;
    continueSession?: boolean;
    addDirs?: string[];
    permissionMode?: 'acceptEdits' | 'auto' | 'bypassPermissions' | 'manual' | 'dontAsk' | 'plan';
    model?: string;
    systemPrompt?: string;
    allowedTools?: string[];
    disallowedTools?: string[];
    maxBudgetUsd?: number;
  }) => ipcRenderer.invoke('claude:run-stream', options),
  claudeStop: (sessionId: string) => ipcRenderer.invoke('claude:stop', sessionId),
  claudeAgents: () => ipcRenderer.invoke('claude:agents'),

  // Streaming listeners for Claude Code
  onClaudeSessionStart: (cb: (data: { sessionId: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { sessionId: string }) => cb(data);
    ipcRenderer.on('claude:session-start', handler);
    return () => ipcRenderer.removeListener('claude:session-start', handler);
  },
  onClaudeStreamChunk: (cb: (chunk: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, chunk: string) => cb(chunk);
    ipcRenderer.on('claude:stream-chunk', handler);
    return () => ipcRenderer.removeListener('claude:stream-chunk', handler);
  },
  onClaudeStreamError: (cb: (err: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, err: string) => cb(err);
    ipcRenderer.on('claude:stream-error', handler);
    return () => ipcRenderer.removeListener('claude:stream-error', handler);
  },

  // Interactive Claude Code terminal (node-pty + xterm.js)
  terminalSpawn: (options: {
    cwd?: string;
    permissionMode?: string;
    model?: string;
    systemPrompt?: string;
    addDirs?: string[];
    resumeSessionId?: string;
  }) => ipcRenderer.invoke('terminal:spawn', options),
  terminalInput: (id: string, data: string) => ipcRenderer.invoke('terminal:input', id, data),
  terminalResize: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', id, cols, rows),
  terminalKill: (id: string) => ipcRenderer.invoke('terminal:kill', id),
  terminalList: () => ipcRenderer.invoke('terminal:list'),

  // Terminal streaming listeners
  onTerminalData: (cb: (data: { id: string; data: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { id: string; data: string }) => cb(data);
    ipcRenderer.on('terminal:data', handler);
    return () => ipcRenderer.removeListener('terminal:data', handler);
  },
  onTerminalExit: (cb: (data: { id: string; exitCode: number | null; signal: string | null }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { id: string; exitCode: number | null; signal: string | null }) => cb(data);
    ipcRenderer.on('terminal:exit', handler);
    return () => ipcRenderer.removeListener('terminal:exit', handler);
  }
});
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { LLMClient } from './src/llm/client';
import { ConfigStore } from './src/llm/configStore';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#111113'
  });

  // Production: Load from file; Development: Load from Vite
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }

  return win;
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Window control handler
ipcMain.handle('window:control', (_event, action: 'close' | 'minimize' | 'maximize') => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { ok: false };
  if (action === 'close') win.close();
  else if (action === 'minimize') win.minimize();
  else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
  return { ok: true };
});

// ---------------------------------------------------------------------------
// LLM configuration store (encrypted with Electron safeStorage)
// ---------------------------------------------------------------------------
const configStore = new ConfigStore();

ipcMain.handle('llm:get-config', () => {
  // Returns config WITHOUT the secret key.
  return configStore.getSafe();
});

ipcMain.handle('llm:save-config', (_event, config: { provider: string; apiKey: string; modelId: string; baseUrl: string }) => {
  try {
    configStore.save(config);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
});

ipcMain.handle('llm:test-connection', async () => {
  const cfg = configStore.get();
  if (!cfg) return { ok: false, error: 'No configuration saved.' };

  const client = new LLMClient({
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    modelId: cfg.modelId
  });

  try {
    const result = await client.testConnection();
    return { ok: true, ...result };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
});

ipcMain.handle('llm:chat-stream', async (event, { messages, modelId }: { messages: any[]; modelId?: string }) => {
  const cfg = configStore.get();

  // Authorization: only proceed if a valid API key is configured.
  if (!cfg || !cfg.apiKey) {
    event.sender.send('llm:chat-error', 'No API configuration saved. Open Settings and save your API key.');
    return { ok: false };
  }

  const client = new LLMClient({
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    modelId: modelId || cfg.modelId
  });

  // Signal start of stream so renderer can show typing indicator.
  event.sender.send('llm:chat-start');

  try {
    await client.chatStream({
      messages,
      modelId: modelId || cfg.modelId,
      onChunk: (chunk: string) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:chat-chunk', chunk);
        }
      },
      onError: (error: Error) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:chat-error', error.message);
        }
      },
      onComplete: () => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:chat-done');
        }
      }
    });
    return { ok: true };
  } catch (err: any) {
    if (!event.sender.isDestroyed()) {
      event.sender.send('llm:chat-error', err?.message ?? String(err));
    }
    return { ok: false };
  }
});

ipcMain.handle('llm:stop-generation', () => {
  LLMClient.stopAll();
  return { ok: true };
});

ipcMain.handle('llm:clear-config', () => {
  configStore.clear();
  return { ok: true };
});
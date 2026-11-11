import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as pty from 'node-pty';
import { LLMClient } from './src/llm/client';
import { ConfigStore } from './src/llm/configStore';

// ---------------------------------------------------------------------------
// Claude Code CLI resolution (priority list, resolved at startup)
// ---------------------------------------------------------------------------

/**
 * Resolve the absolute path to the `claude` executable.
 * Priority: zsh login shell PATH, then well-known install locations.
 * Returns the absolute path, or null if not found — never falls back to 'claude'
 * because the Dock-launched app does not inherit the user's shell PATH.
 */
// Lazy, async resolution: the first call (on first Claude Code request)
// resolves and caches the executable path. Never falls back to 'claude'
// because the Dock-launched app does not inherit the user's shell PATH.
let claudeExecutableCache: string | null | undefined;

async function getClaudeExecutable(): Promise<string | null> {
  if (claudeExecutableCache !== undefined) return claudeExecutableCache;

  const home = process.env.HOME || '';
  const candidates: string[] = [];

  // 1. zsh login shell PATH (most reliable for user-installed CLIs)
  try {
    const { execFile } = require('child_process');
    const fromShell = await new Promise<string>((resolve) => {
      execFile('zsh', ['-ilc', 'command -v claude'], { timeout: 3000, maxBuffer: 4096 },
        (err: Error | null, stdout: string) => {
          if (err) return resolve('');
          // Take the last non-empty line of output.
          const lines = stdout.split('\n').map((l: string) => l.trim()).filter(Boolean);
          resolve(lines.length ? lines[lines.length - 1] : '');
        });
    });
    if (fromShell && fs.existsSync(fromShell)) candidates.push(fromShell);
  } catch {
    // zsh unavailable or timed out — fall through to static list
  }

  // 2. Well-known install locations
  candidates.push(
    path.join(home, '.local', 'bin', 'claude'),
    path.join(home, '.claude', 'local', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  );

  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p) && fs.statSync(p).isFile()) {
        claudeExecutableCache = p;
        return p;
      }
    } catch {}
  }

  claudeExecutableCache = null;
  return null;
}

/**
 * Build the environment for the Claude Code child process.
 * SEPARATE from the chat/terminal env builders — this is the Anthropic-style
 * /v1/messages path, so it injects ANTHROPIC_* vars and explicitly unsets
 * ANTHROPIC_API_KEY (the token is passed as ANTHROPIC_AUTH_TOKEN).
 * The decrypted API key never leaves this process.
 *
 * NOTE: CLAUDE_CODE_SIMPLE is NOT set here. That flag mirrors `--bare` and
 * disables hooks, LSP, plugin sync, CLAUDE.md auto-discovery and more — it
 * would strip out the tooling features the Claude Code tab relies on.
 */
function buildClaudeEnv(llmConfig?: { baseUrl?: string; apiKey?: string; modelId?: string }): NodeJS.ProcessEnv {
  const home = process.env.HOME || '';
  const extraPaths = [
    path.join(home, '.local', 'bin'),
    path.join(home, '.npm-global', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(home, '.bun', 'bin'),
    path.join(home, '.volta', 'bin'),
  ];
  const pathEntries = (process.env.PATH || '').split(path.delimiter);
  const merged = [...new Set([...extraPaths, ...pathEntries])];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: merged.join(path.delimiter),
  };

  // Anthropic-compatible provider config (FreeLLMAPI, etc.).
  // Claude Code appends /v1/messages itself, so the base URL must NOT end in
  // /v1 — otherwise it would request /v1/v1/messages and 404.
  if (llmConfig?.baseUrl && llmConfig?.apiKey) {
    let baseUrl = llmConfig.baseUrl.replace(/\/+$/, '');
    if (baseUrl.endsWith('/v1')) baseUrl = baseUrl.slice(0, -3);
    env.ANTHROPIC_BASE_URL = baseUrl;
    env.ANTHROPIC_AUTH_TOKEN = llmConfig.apiKey;
    if (llmConfig.modelId) env.ANTHROPIC_MODEL = llmConfig.modelId;
  }

  // Never use a raw ANTHROPIC_API_KEY — the token is passed as AUTH_TOKEN.
  delete env.ANTHROPIC_API_KEY;

  return env;
}

/**
 * Build a safe environment for the interactive PTY terminal (unchanged).
 */
function buildChildEnv(llmConfig?: { baseUrl?: string; apiKey?: string; modelId?: string }): NodeJS.ProcessEnv {
  const home = process.env.HOME || '';
  const extraPaths = [
    path.join(home, '.local', 'bin'),
    path.join(home, '.npm-global', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(home, '.bun', 'bin'),
    path.join(home, '.volta', 'bin'),
  ];
  const pathEntries = (process.env.PATH || '').split(path.delimiter);
  const merged = [...new Set([...extraPaths, ...pathEntries])];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: merged.join(path.delimiter),
    CLAUDE_CODE_SIMPLE: '1'
  };

  if (llmConfig?.baseUrl && llmConfig?.apiKey) {
    env.ANTHROPIC_BASE_URL = llmConfig.baseUrl;
    env.ANTHROPIC_AUTH_TOKEN = llmConfig.apiKey;
    if (llmConfig.modelId) env.ANTHROPIC_MODEL = llmConfig.modelId;
  }

  return env;
}

// ---------------------------------------------------------------------------
// Workspace root tracking (per window) — prevents path traversal
// ---------------------------------------------------------------------------
const windowRoots = new Map<number, string>();

function getWindowId(event: Electron.IpcMainInvokeEvent): number {
  return event.sender.id;
}

function getWorkspaceRoot(event: Electron.IpcMainInvokeEvent): string | undefined {
  return windowRoots.get(getWindowId(event));
}

function setWorkspaceRoot(event: Electron.IpcMainInvokeEvent, root: string) {
  windowRoots.set(getWindowId(event), root);
}

function clearWorkspaceRoot(event: Electron.IpcMainInvokeEvent) {
  windowRoots.delete(getWindowId(event));
}

/**
 * Validate that a requested path resolves to within the allowed workspace root.
 * Uses fs.realpathSync to resolve symlinks and prevent traversal attacks.
 */
function isPathAllowed(requestedPath: string, event: Electron.IpcMainInvokeEvent): { ok: boolean; resolvedPath?: string; error?: string } {
  const root = getWorkspaceRoot(event);
  if (!root) {
    return { ok: false, error: 'No workspace open. Use fs:open-folder first.' };
  }
  try {
    const realRoot = fs.realpathSync(root);
    const realRequested = fs.realpathSync(requestedPath);
    if (realRequested === realRoot || realRequested.startsWith(realRoot + path.sep)) {
      return { ok: true, resolvedPath: realRequested };
    }
    return { ok: false, error: 'Access denied: path is outside the workspace root.' };
  } catch {
    return { ok: false, error: 'Access denied: could not resolve path.' };
  }
}

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

  // Clean up workspace root when window closes
  win.on('closed', () => {
    windowRoots.delete(win.id);
  });

  // Production: Load from file; Development: Load from Vite
  // Check if we're running from the dist folder (built) or from source
  const isDev = !app.isPackaged && process.argv.some(arg => arg.includes('vite') || arg.includes('ts-node'));
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
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
// Claude Code CLI Integration (New Contract)
// ---------------------------------------------------------------------------
const CLAUDE_ALLOWED_TOOLS = 'Read,Glob,Grep,Edit,Write,TodoWrite,Bash(ls:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*),Bash(npm run build:*),Bash(npm test:*),Bash(python3 hello.py)';
const CLAUDE_DISALLOWED_TOOLS = 'Bash(rm:*),Bash(sudo:*),Bash(curl:*),Bash(wget:*),WebFetch,WebSearch';

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

// ---------------------------------------------------------------------------
// File system helpers (all I/O happens in the main process)
// ---------------------------------------------------------------------------

/** Read a file's contents as UTF-8 text. */
ipcMain.handle('fs:read-file', (event, filePath: string) => {
  const check = isPathAllowed(filePath, event);
  if (!check.ok) return { ok: false, error: check.error };
  try {
    if (!fs.existsSync(check.resolvedPath!)) return { ok: false, error: 'File not found.' };
    const stat = fs.statSync(check.resolvedPath!);
    if (!stat.isFile()) return { ok: false, error: 'Path is not a file.' };
    const content = fs.readFileSync(check.resolvedPath!, 'utf8');
    return { ok: true, content };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
});

/** Write text content to a file. */
ipcMain.handle('fs:write-file', (event, filePath: string, content: string) => {
  const check = isPathAllowed(filePath, event);
  if (!check.ok) return { ok: false, error: check.error };
  try {
    const dir = path.dirname(check.resolvedPath!);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(check.resolvedPath!, content, { encoding: 'utf8', mode: 0o600 });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
});

/** Build a recursive file tree for a directory. */
function buildTree(dirPath: string, rootPath: string): any[] {
  const entries: any[] = [];
  let items: fs.Dirent[];
  try {
    items = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return entries;
  }
  // Sort: folders first, then files, both alphabetically.
  items.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });
  for (const item of items) {
    if (item.name.startsWith('.') || item.name === 'node_modules') continue;
    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      entries.push({
        id: fullPath,
        name: item.name,
        type: 'folder',
        path: fullPath,
        children: buildTree(fullPath, rootPath)
      });
    } else if (item.isFile()) {
      entries.push({
        id: fullPath,
        name: item.name,
        type: 'file',
        path: fullPath
      });
    }
  }
  return entries;
}

/** Open a directory and return its file tree. */
ipcMain.handle('fs:open-folder', async (event) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { ok: false, error: 'No focused window.' };
  const result = await dialog.showOpenDialog(win, {
    title: 'Open Folder',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) {
    return { ok: false, canceled: true };
  }
  const folderPath = result.filePaths[0];
  const tree = buildTree(folderPath, folderPath);
  setWorkspaceRoot(event, folderPath);
  return { ok: true, path: folderPath, name: path.basename(folderPath), tree };
});

/** Create a new file inside a project directory. */
ipcMain.handle('fs:create-file', (event, parentDir: string, fileName: string) => {
  const check = isPathAllowed(parentDir, event);
  if (!check.ok) return { ok: false, error: check.error };
  try {
    const fullPath = path.join(check.resolvedPath!, fileName);
    if (fs.existsSync(fullPath)) return { ok: false, error: 'File already exists.' };
    fs.writeFileSync(fullPath, '', { encoding: 'utf8', mode: 0o600 });
    return { ok: true, path: fullPath };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
});

/** Create a new folder inside a project directory. */
ipcMain.handle('fs:create-folder', (event, parentDir: string, folderName: string) => {
  const check = isPathAllowed(parentDir, event);
  if (!check.ok) return { ok: false, error: check.error };
  try {
    const fullPath = path.join(check.resolvedPath!, folderName);
    if (fs.existsSync(fullPath)) return { ok: false, error: 'Folder already exists.' };
    fs.mkdirSync(fullPath, { recursive: true, mode: 0o700 });
    return { ok: true, path: fullPath };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
});

/** Delete a file or folder. */
ipcMain.handle('fs:delete', (event, fullPath: string) => {
  const check = isPathAllowed(fullPath, event);
  if (!check.ok) return { ok: false, error: check.error };
  try {
    if (!fs.existsSync(check.resolvedPath!)) return { ok: false, error: 'Path not found.' };
    const stat = fs.statSync(check.resolvedPath!);
    if (stat.isDirectory()) {
      fs.rmSync(check.resolvedPath!, { recursive: true, force: true });
    } else {
      fs.unlinkSync(check.resolvedPath!);
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
});

/** Rename a file or folder. */
ipcMain.handle('fs:rename', (event, oldPath: string, newPath: string) => {
  const checkOld = isPathAllowed(oldPath, event);
  const checkNew = isPathAllowed(newPath, event);
  if (!checkOld.ok) return { ok: false, error: checkOld.error };
  if (!checkNew.ok) return { ok: false, error: checkNew.error };
  try {
    if (!fs.existsSync(checkOld.resolvedPath!)) return { ok: false, error: 'Path not found.' };
    if (fs.existsSync(checkNew.resolvedPath!)) return { ok: false, error: 'Destination already exists.' };
    fs.renameSync(checkOld.resolvedPath!, checkNew.resolvedPath!);
    return { ok: true, path: checkNew.resolvedPath };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
});

// ---------------------------------------------------------------------------
// Recently opened projects (persisted in userData)
// ---------------------------------------------------------------------------
const RECENT_FILE = path.join(app.getPath('userData'), 'recent-projects.json');

function loadRecent(): string[] {
  try {
    if (!fs.existsSync(RECENT_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(RECENT_FILE, 'utf8'));
    return Array.isArray(raw) ? raw.filter((p: any) => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecent(paths: string[]) {
  fs.writeFileSync(RECENT_FILE, JSON.stringify(paths, null, 2), { encoding: 'utf8', mode: 0o600 });
}

ipcMain.handle('fs:get-recent', () => loadRecent());

ipcMain.handle('fs:add-recent', (_event, folderPath: string) => {
  const recent = loadRecent().filter((p) => p !== folderPath);
  recent.unshift(folderPath);
  saveRecent(recent.slice(0, 10));
  return { ok: true, recent };
});

// ---------------------------------------------------------------------------
// Refresh file tree
// ---------------------------------------------------------------------------
ipcMain.handle('fs:refresh-tree', (event) => {
  const root = getWorkspaceRoot(event);
  if (!root) return { ok: false, error: 'No workspace open.' };
  const tree = buildTree(root, root);
  return { ok: true, tree };
});

// ---------------------------------------------------------------------------
// Claude Code CLI Integration
// ---------------------------------------------------------------------------

interface ClaudeCodeResult {
  ok: boolean;
  sessionId?: string;
  output?: string;
  error?: string;
}

/** Check if Claude Code CLI is available and get version. */
ipcMain.handle('claude:check-availability', async () => {
  return new Promise<ClaudeCodeResult>(async (resolve) => {
    const executable = await getClaudeExecutable();
    if (!executable) {
      resolve({ ok: false, error: 'Claude Code CLI not found. Install it (npm i -g @anthropic-ai/claude-code) or check your PATH.' });
      return;
    }
    const child = spawn(executable, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: buildChildEnv()
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        resolve({ ok: true, output: stdout.trim() });
      } else {
        resolve({ ok: false, error: `Claude Code not found (tried: ${executable}): ${stderr || 'command failed'}` });
      }
    });
    child.on('error', (err) => {
      resolve({ ok: false, error: `Failed to execute claude: ${err.message}` });
    });
  });
});

/** Get Claude Code authentication status. */
ipcMain.handle('claude:auth-status', async () => {
  // First check if user has a custom LLM provider configured (FreeLLMAPI, etc.)
  // If so, they don't need Anthropic OAuth - the CLI will use env vars we inject.
  const configStore = new ConfigStore();
  const llmConfig = configStore.get();
  const hasCustomProvider = !!(llmConfig?.baseUrl && llmConfig?.apiKey);

  const executable = await getClaudeExecutable();
  if (!executable) {
    return { ok: false, error: 'Claude Code CLI not found.' };
  }

  return new Promise<ClaudeCodeResult>((resolve) => {
    const child = spawn(executable, ['auth', 'status'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: buildChildEnv()
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('close', (code) => {
      console.log('[claude:auth-status] CLI exit code:', code, 'stdout:', stdout.trim().slice(0, 100));
      if (code === 0 && stdout.trim()) {
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve({ ok: true, output: JSON.stringify(parsed) });
        } catch {
          resolve({ ok: false, error: 'Invalid auth status output' });
        }
      } else if (hasCustomProvider) {
        // No Anthropic OAuth, but custom provider is configured - that's fine
        console.log('[claude:auth-status] Falling back to custom provider auth');
        resolve({ ok: true, output: JSON.stringify({
          loggedIn: true,
          authMethod: 'custom_provider',
          apiProvider: 'thirdParty',
          customProvider: llmConfig?.provider || 'LLM API'
        }) });
      } else {
        resolve({ ok: false, error: `Auth check failed: ${stderr || 'command failed'}` });
      }
    });
    child.on('error', (err) => {
      console.log('[claude:auth-status] CLI error:', err.message);
      // If CLI fails but custom provider is configured, that's still OK
      if (hasCustomProvider) {
        resolve({ ok: true, output: JSON.stringify({
          loggedIn: true,
          authMethod: 'custom_provider',
          apiProvider: 'thirdParty',
          customProvider: llmConfig?.provider || 'LLM API'
        }) });
      } else {
        resolve({ ok: false, error: `Failed to execute claude auth: ${err.message}` });
      }
    });
  });
});

interface RunClaudeOptions {
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
}

/**
 * Validate that all addDirs are within the workspace root or are explicitly allowed.
 * Returns an error message if any path is invalid.
 */
function validateAddDirs(addDirs: string[], workspaceRoot: string): string | null {
  try {
    const realRoot = fs.realpathSync(workspaceRoot);
    for (const dir of addDirs) {
      const realDir = fs.realpathSync(dir);
      // Must be within workspace OR be a subdirectory of workspace
      if (realDir === realRoot || realDir.startsWith(realRoot + path.sep)) {
        continue; // OK - inside workspace
      }
      // Allow absolute paths that are explicitly passed, but reject relative traversal
      if (path.isAbsolute(dir)) {
        // This is an explicit additional directory - allow it but warn
        console.warn(`[ClaudeCode] Additional directory outside workspace: ${dir}`);
      } else {
        return `Invalid add-dir: ${dir} (must be absolute path)`;
      }
    }
    return null;
  } catch {
    return 'Failed to validate additional directories';
  }
}

/** Run Claude Code in streaming mode (--print --output-format=stream-json --verbose). */
ipcMain.handle('claude:run-stream', async (event, options: RunClaudeOptions) => {
  const { prompt, cwd, sessionId, continueSession, addDirs, permissionMode, model, systemPrompt, allowedTools, disallowedTools, maxBudgetUsd } = options;

  const workspaceRoot = getWorkspaceRoot(event);
  const effectiveCwd = cwd || workspaceRoot;

  if (!effectiveCwd) {
    return { ok: false, error: 'No workspace open. Open a folder first.' };
  }

  // Validate that the cwd is within the workspace
  const check = isPathAllowed(effectiveCwd, event);
  if (!check.ok) {
    return { ok: false, error: check.error };
  }

  // Validate addDirs
  if (addDirs && addDirs.length > 0) {
    const addDirError = validateAddDirs(addDirs, effectiveCwd);
    if (addDirError) {
      return { ok: false, error: addDirError };
    }
  }

  // Default to acceptEdits - never bypassPermissions by default
  const effectivePermissionMode = permissionMode || 'acceptEdits';

  const args = ['--print', '--output-format=stream-json', '--verbose'];

  if (sessionId) {
    args.push('--resume', sessionId);
  } else if (continueSession) {
    args.push('--continue');
  }

  if (addDirs && addDirs.length > 0) {
    for (const dir of addDirs) {
      args.push('--add-dir', dir);
    }
  }

  args.push('--permission-mode', effectivePermissionMode);

  if (model) {
    args.push('--model', model);
  }

  if (systemPrompt) {
    args.push('--system-prompt', systemPrompt);
  }

  if (allowedTools && allowedTools.length > 0) {
    args.push('--allowed-tools', allowedTools.join(','));
  }

  if (disallowedTools && disallowedTools.length > 0) {
    args.push('--disallowed-tools', disallowedTools.join(','));
  }

  if (maxBudgetUsd !== undefined) {
    args.push('--max-budget-usd', String(maxBudgetUsd));
  }

  // Use -- to mark end of options, preventing argument injection if prompt starts with -
  args.push('--', prompt);

  // Load user's LLM config to inject FreeLLM / Anthropic-compatible env vars
  const configStore = new ConfigStore();
  const llmConfig = configStore.get();

  const executable = await getClaudeExecutable();
  if (!executable) {
    return { ok: false, error: 'Claude Code CLI not found.' };
  }

  const child = spawn(executable, args, {
    cwd: effectiveCwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: buildClaudeEnv(llmConfig || undefined)
  });

  let sessionIdFromOutput: string | undefined;
  let buffer = '';

  // Send session ID if available from the first output
  child.stdout.on('data', (data) => {
    buffer += data.toString();
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
      buffer = buffer.slice(newlineIndex + 1);

      if (!line.trim()) continue;

      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'system' && parsed.subtype === 'session_start') {
          sessionIdFromOutput = parsed.session_id;
          if (!event.sender.isDestroyed()) {
            event.sender.send('claude:session-start', { sessionId: sessionIdFromOutput });
          }
        } else if (!event.sender.isDestroyed()) {
          event.sender.send('claude:stream-chunk', line);
        }
      } catch {
        // Not JSON, send as-is
        if (!event.sender.isDestroyed()) {
          event.sender.send('claude:stream-chunk', line);
        }
      }
    }
  });

  // Handle remaining buffer on close
  child.on('close', () => {
    if (buffer.trim() && !event.sender.isDestroyed()) {
      const lines = buffer.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'system' && parsed.subtype === 'session_start') {
            sessionIdFromOutput = parsed.session_id;
            event.sender.send('claude:session-start', { sessionId: sessionIdFromOutput });
          } else {
            event.sender.send('claude:stream-chunk', line);
          }
        } catch {
          event.sender.send('claude:stream-chunk', line);
        }
      }
    }
  });

  child.stderr.on('data', (data) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('claude:stream-error', data.toString());
    }
  });

  return new Promise<ClaudeCodeResult>((resolve) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, sessionId: sessionIdFromOutput });
      } else {
        resolve({ ok: false, error: `Claude exited with code ${code}` });
      }
    });

    child.on('error', (err) => {
      resolve({ ok: false, error: `Failed to spawn claude: ${err.message}` });
    });
  });
});

/** Stop a running Claude Code session. */
ipcMain.handle('claude:stop', async (_event, sessionId: string) => {
  const executable = await getClaudeExecutable();
  if (!executable) return { ok: false, error: 'Claude Code CLI not found.' };
  return new Promise<ClaudeCodeResult>((resolve) => {
    const child = spawn(executable, ['stop', sessionId], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: buildChildEnv()
    });
    let stderr = '';
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true });
      } else {
        resolve({ ok: false, error: stderr || `Stop failed with code ${code}` });
      }
    });
    child.on('error', (err) => {
      resolve({ ok: false, error: `Failed to execute stop: ${err.message}` });
    });
  });
});

/** List background Claude Code agents. */
ipcMain.handle('claude:agents', async () => {
  const executable = await getClaudeExecutable();
  if (!executable) return { ok: false, error: 'Claude Code CLI not found.' };
  return new Promise<ClaudeCodeResult>((resolve) => {
    const child = spawn(executable, ['agents'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: buildChildEnv()
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        resolve({ ok: true, output: stdout.trim() });
      } else {
        resolve({ ok: false, error: `Agents list failed: ${stderr || 'command failed'}` });
      }
    });
    child.on('error', (err) => {
      resolve({ ok: false, error: `Failed to execute agents: ${err.message}` });
    });
  });
});

// ---------------------------------------------------------------------------
// Interactive Claude Code terminal (node-pty + xterm.js)
// ---------------------------------------------------------------------------

interface TerminalSession {
  id: string;
  pty: pty.IPty;
  cwd: string;
}

const terminalSessions = new Map<string, TerminalSession>();
let terminalIdCounter = 0;

/**
 * Spawn an interactive Claude Code session inside a pseudo-terminal.
 * Uses node-pty so the CLI runs as a real TTY (interactive mode, colors, Ctrl+C).
 * FreeLLMAPI / Anthropic-compatible env vars are injected from the saved config.
 */
ipcMain.handle('terminal:spawn', async (event, options: {
  cwd?: string;
  permissionMode?: string;
  model?: string;
  systemPrompt?: string;
  addDirs?: string[];
  resumeSessionId?: string;
}) => {
  const { cwd, permissionMode, model, systemPrompt, addDirs, resumeSessionId } = options;

  const workspaceRoot = getWorkspaceRoot(event);
  const effectiveCwd = cwd || workspaceRoot || process.env.HOME || '/';

  if (!workspaceRoot) {
    // Allow spawning in HOME even without an explicit workspace open
    // (so the terminal still works from the start screen).
  }

  // Validate cwd is within workspace when a workspace is open
  if (workspaceRoot) {
    try {
      const realRoot = fs.realpathSync(workspaceRoot);
      const realCwd = fs.realpathSync(effectiveCwd);
      if (realCwd !== realRoot && !realCwd.startsWith(realRoot + path.sep)) {
        return { ok: false, error: 'Terminal cwd is outside the workspace root.' };
      }
    } catch {
      return { ok: false, error: 'Could not resolve terminal working directory.' };
    }
  }

  // Validate user-supplied values to prevent argv flag smuggling.
  const ALLOWED_PERMISSION_MODES = ['acceptEdits', 'auto', 'manual', 'plan', 'dontAsk'];
  function assertNoLeadingDash(val: string, name: string): string | null {
    if (typeof val !== 'string') return `${name} must be a string.`;
    if (val.startsWith('-')) return `${name} cannot start with '-'.`;
    return null;
  }

  const args: string[] = [];

  if (resumeSessionId) {
    const err = assertNoLeadingDash(resumeSessionId, 'resumeSessionId');
    if (err) return { ok: false, error: err };
    args.push('--resume', resumeSessionId);
  }

  if (addDirs && addDirs.length > 0) {
    for (const dir of addDirs) {
      const err = assertNoLeadingDash(dir, 'addDir');
      if (err) return { ok: false, error: err };
      if (!path.isAbsolute(dir)) return { ok: false, error: `Invalid add-dir: ${dir} (must be absolute path)` };
      args.push('--add-dir', dir);
    }
  }

  if (permissionMode) {
    if (!ALLOWED_PERMISSION_MODES.includes(permissionMode)) {
      return { ok: false, error: `Invalid permission mode: ${permissionMode}` };
    }
    args.push('--permission-mode', permissionMode);
  }

  if (model) {
    const err = assertNoLeadingDash(model, 'model');
    if (err) return { ok: false, error: err };
    args.push('--model', model);
  }

  if (systemPrompt) {
    const err = assertNoLeadingDash(systemPrompt, 'systemPrompt');
    if (err) return { ok: false, error: err };
    args.push('--system-prompt', systemPrompt);
  }

  // Load saved LLM config and inject into the PTY environment
  const cfgStore = new ConfigStore();
  const llmConfig = cfgStore.get();

  const executable = await getClaudeExecutable();
  if (!executable) {
    return { ok: false, error: 'Claude Code CLI not found.' };
  }

  const id = `term-${++terminalIdCounter}`;
  const cols = 120;
  const rows = 30;

  let ptyProcess: pty.IPty;
  try {
    ptyProcess = pty.spawn(executable, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: effectiveCwd,
      env: buildChildEnv(llmConfig || undefined) as { [key: string]: string | undefined },
    });
  } catch (err: any) {
    return { ok: false, error: `Failed to spawn Claude Code terminal: ${err?.message ?? String(err)}` };
  }

  terminalSessions.set(id, { id, pty: ptyProcess, cwd: effectiveCwd });

  // Forward PTY output to the renderer
  ptyProcess.onData((data: string) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('terminal:data', { id, data });
    }
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('terminal:exit', { id, exitCode, signal });
    }
    terminalSessions.delete(id);
  });

  return { ok: true, id, cwd: effectiveCwd };
});

/** Send keyboard input to a running Claude Code terminal. */
ipcMain.handle('terminal:input', (_event, id: string, data: string) => {
  const session = terminalSessions.get(id);
  if (!session) return { ok: false, error: 'Terminal session not found.' };
  try {
    session.pty.write(data);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
});

/** Resize a Claude Code terminal. */
ipcMain.handle('terminal:resize', (_event, id: string, cols: number, rows: number) => {
  const session = terminalSessions.get(id);
  if (!session) return { ok: false, error: 'Terminal session not found.' };
  try {
    session.pty.resize(cols, rows);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
});

/** Kill a Claude Code terminal session. */
ipcMain.handle('terminal:kill', (_event, id: string) => {
  const session = terminalSessions.get(id);
  if (!session) return { ok: false, error: 'Terminal session not found.' };
  try {
    session.pty.kill();
    terminalSessions.delete(id);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
});

/** Get the list of active Claude Code terminal sessions. */
ipcMain.handle('terminal:list', () => {
  return {
    ok: true,
    sessions: Array.from(terminalSessions.values()).map((s) => ({ id: s.id, cwd: s.cwd }))
  };
});

// Cleanup on window close
app.on('window-all-closed', () => {
  for (const session of terminalSessions.values()) {
    try { session.pty.kill(); } catch {}
  }
  terminalSessions.clear();
});
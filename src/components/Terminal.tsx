import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XtermTerminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

type TerminalStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected';

interface TerminalData {
  id: string;
  data: string;
}

interface TerminalExit {
  id: string;
  exitCode: number | null;
  signal: string | null;
}

interface ElectronAPI {
  terminalSpawn: (options: {
    cwd?: string;
    permissionMode?: string;
    model?: string;
    systemPrompt?: string;
    addDirs?: string[];
    resumeSessionId?: string;
  }) => Promise<{ ok: boolean; id?: string; cwd?: string; error?: string }>;
  terminalInput: (id: string, data: string) => Promise<{ ok: boolean; error?: string }>;
  terminalResize: (id: string, cols: number, rows: number) => Promise<{ ok: boolean; error?: string }>;
  terminalKill: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onTerminalData: (cb: (data: TerminalData) => void) => () => void;
  onTerminalExit: (cb: (data: TerminalExit) => void) => () => void;
}

const api = (window as any).electronAPI as ElectronAPI | undefined;

export function Terminal() {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XtermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<TerminalStatus>('idle');
  const isInitializedRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const startTerminal = useCallback(async () => {
    if (!api?.terminalSpawn) {
      setStatus('error');
      return;
    }
    setStatus('connecting');
    try {
      // Spawn inside the CodeCraft project vault so the workspace root check passes.
      let cwd = process.env.HOME || '/tmp';
      try {
        const vault = await (window as any).electronAPI?.fsGetVaultPath?.();
        if (vault?.ok && vault?.path) cwd = vault.path;
      } catch {}
      const result = await api.terminalSpawn({
        cwd,
        permissionMode: 'acceptEdits',
      });
      if (result.ok && result.id) {
        sessionIdRef.current = result.id;
        setSessionId(result.id);
        setStatus('connected');
      } else {
        setStatus('error');
        console.error('[Terminal] spawn failed:', result.error);
      }
    } catch (err: any) {
      setStatus('error');
      console.error('[Terminal] spawn error:', err.message ?? String(err));
    }
  }, [api]);

  const sendInput = useCallback((data: string) => {
    const id = sessionIdRef.current;
    if (!id || !api?.terminalInput) return;
    api.terminalInput(id, data).catch((err: any) => {
      console.error('[Terminal] input error:', err.message ?? String(err));
      setStatus('error');
    });
  }, [api]);

  const handleResize = useCallback(() => {
    const id = sessionIdRef.current;
    const term = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!id || !term || !fitAddon || !api?.terminalResize) return;

    fitAddon.fit();
    const cols = term.cols;
    const rows = term.rows;
    if (cols > 0 && rows > 0) {
      api.terminalResize(id, cols, rows).catch((err: any) => {
        console.error('[Terminal] resize error:', err.message ?? String(err));
      });
    }
  }, [api]);

  // Initialize xterm when container is ready and session is connected
  useEffect(() => {
    const container = terminalContainerRef.current;
    if (!container || status !== 'connected' || isInitializedRef.current) return;

    // Create xterm instance
    const xterm = new XtermTerminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", "Monaco", "Menlo", "Ubuntu Mono", monospace',
      fontSize: 13,
      lineHeight: 1.5,
      letterSpacing: 0,
      theme: {
        background: '#111113',
        foreground: '#e0e0e0',
        cursor: '#58a6ff',
        cursorAccent: '#111113',
        selectionBackground: 'rgba(88, 166, 255, 0.3)',
        black: '#1d1f21',
        red: '#ff6b6b',
        green: '#4ade80',
        yellow: '#f59e0b',
        blue: '#58a6ff',
        magenta: '#d2a8ff',
        cyan: '#5eead4',
        white: '#e0e0e0',
        brightBlack: '#6b7280',
        brightRed: '#ff6b6b',
        brightGreen: '#4ade80',
        brightYellow: '#f59e0b',
        brightBlue: '#58a6ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#5eead4',
        brightWhite: '#f0f0f0',
      },
      allowProposedApi: true,
      convertEol: true,
      scrollback: 10000,
      disableStdin: false,
      windowsMode: false,
      macOptionIsMeta: true,
    });

    // Create and attach fit addon
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    // Open terminal in container
    xterm.open(container);

    // Initial fit
    fitAddon.fit();

    // Store refs
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    isInitializedRef.current = true;

    // Handle input from xterm (keyboard, paste, etc.)
    const inputDisposable = xterm.onData((data) => {
      sendInput(data);
    });

    // Handle resize - use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    resizeObserverRef.current = resizeObserver;

    // Also handle xterm's built-in resize event (e.g., from fit addon)
    const resizeDisposable = xterm.onResize(({ cols, rows }) => {
      const id = sessionIdRef.current;
      if (id && api?.terminalResize && cols > 0 && rows > 0) {
        api.terminalResize(id, cols, rows).catch((err: any) => {
          console.error('[Terminal] resize error:', err.message ?? String(err));
        });
      }
    });

    // Focus the terminal
    xterm.focus();

    // Cleanup function
    return () => {
      inputDisposable.dispose();
      resizeDisposable.dispose();
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      isInitializedRef.current = false;
    };
  }, [status, sendInput, handleResize, api]);

  // Subscribe to PTY data stream from main process
  useEffect(() => {
    const id = sessionIdRef.current;
    if (!id || !api?.onTerminalData) return;

    const unsub = api.onTerminalData((data: TerminalData) => {
      if (data.id !== id) return;
      const term = xtermRef.current;
      if (term) {
        term.write(data.data);
      }
    });

    return () => unsub();
  }, [api, sessionId]);

  // Subscribe to PTY exit events
  useEffect(() => {
    const id = sessionIdRef.current;
    if (!id || !api?.onTerminalExit) return;

    const unsub = api.onTerminalExit((data: TerminalExit) => {
      if (data.id !== id) return;
      setStatus('disconnected');
      sessionIdRef.current = null;
      setSessionId(null);
      // Clean up xterm
      const term = xtermRef.current;
      if (term) {
        term.write('\r\n\x1b[33m[Terminal disconnected]\x1b[0m\r\n');
      }
    });

    return () => unsub();
  }, [api, sessionId]);

  // Auto-start terminal on mount
  useEffect(() => {
    startTerminal();
    return () => {
      const id = sessionIdRef.current;
      if (id && api?.terminalKill) {
        api.terminalKill(id).catch(() => {});
      }
    };
  }, [startTerminal, api]);

  return (
    <div className="terminal-container" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        ref={terminalContainerRef}
        className="terminal"
        style={{
          flex: 1,
          border: '1px solid #2a2a2d',
          backgroundColor: '#111113',
          color: '#e0e0e0',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {status === 'connecting' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#9ca3af',
            fontFamily: 'monospace',
            fontSize: '13px',
          }}>
            ● Connecting to Claude Code terminal…
          </div>
        )}
        {status === 'error' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#ff6b6b',
            fontFamily: 'monospace',
            fontSize: '13px',
            padding: '20px',
            textAlign: 'center',
          }}>
            ● Terminal error. See console for details.
          </div>
        )}
        {status === 'disconnected' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#f59e0b',
            fontFamily: 'monospace',
            fontSize: '13px',
            padding: '20px',
            textAlign: 'center',
          }}>
            ● Terminal disconnected. Reload to reconnect.
          </div>
        )}
        {status === 'idle' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#6b7280',
            fontFamily: 'monospace',
            fontSize: '13px',
          }}>
            ● Waiting for terminal session…
          </div>
        )}
      </div>

      <div className="terminal-status-bar" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        borderTop: '1px solid #2a2a2d',
        backgroundColor: '#1a1a1d',
        fontSize: '11px',
        color: '#6b7280',
        fontFamily: 'monospace',
        height: '28px',
      }}>
        <span>{status === 'connected' ? '● Connected' : status === 'connecting' ? '● Connecting…' : status === 'error' ? '● Error' : status === 'disconnected' ? '● Disconnected' : '● Idle'}</span>
        <span>{xtermRef.current ? `${xtermRef.current.cols}×${xtermRef.current.rows}` : '—×—'}</span>
      </div>
    </div>
  );
}
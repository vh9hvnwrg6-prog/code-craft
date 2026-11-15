import React, { useState, useEffect } from 'react';
import { Terminal as TerminalIcon, Brain, BookOpen, Plus, Save, Trash2 } from 'lucide-react';
import { Terminal } from './Terminal';

interface Session {
  id: string;
  title: string;
  updatedAt: number;
}

interface MemoryEntry {
  id: string;
  type: 'fact' | 'preference' | 'project' | 'summary' | 'instruction';
  content: string;
  tags: string[];
  createdAt: number;
}

export function ClaudeCodePanel({ session }: { session: Session | null }) {
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [newMemory, setNewMemory] = useState('');

  const killTerminal = () => {
    const api = (window as any).electronAPI;
    if (api?.terminalKill) {
      api.terminalKill('all').catch(() => {});
    }
  };

  // Load persistent memory on mount.
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.memoryList) return;
    api.memoryList().then((res: any) => {
      if (res?.ok) setMemory(res.entries ?? []);
    });
  }, []);

  const addMemory = async () => {
    const text = newMemory.trim();
    if (!text) return;
    const api = (window as any).electronAPI;
    if (!api?.memoryAdd) return;
    try {
      await api.memoryAdd({
        type: 'fact',
        content: text,
        tags: [],
        source: 'user',
      });
      setNewMemory('');
      const res = await api.memoryList();
      if (res?.ok) setMemory(res.entries ?? []);
    } catch (err: any) {
      console.error('[memory] add failed:', err);
    }
  };

  const removeMemory = async (id: string) => {
    const api = (window as any).electronAPI;
    if (!api?.memoryRemove) return;
    try {
      await api.memoryRemove(id);
      const res = await api.memoryList();
      if (res?.ok) setMemory(res.entries ?? []);
    } catch (err: any) {
      console.error('[memory] remove failed:', err);
    }
  };

  return (
    <div className="claude-code-panel">
      <div className="panel-header">
        <div className="panel-title-row">
          <span className="panel-title">
            <TerminalIcon size={14} />
            CLAUDE CODE
          </span>
          <div className="status-badges" id="claude-status-badges" />
        </div>
        <div className="panel-actions">
          <button
            className="icon-btn"
            onClick={() => setMemoryOpen(!memoryOpen)}
            title="Memory"
            aria-label="Toggle memory"
          >
            <Brain size={13} />
          </button>
          <button className="icon-btn" onClick={killTerminal} title="Kill terminal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="claude-body">
        {memoryOpen ? (
          <div className="claude-memory">
            <div className="claude-memory-header">
              <span className="claude-memory-title">
                <BookOpen size={13} />
                Claude Memory
              </span>
              <span className="claude-memory-count">{memory.length}</span>
            </div>
            <div className="claude-memory-list">
              {memory.length === 0 ? (
                <div className="claude-memory-empty">
                  <span>No memories yet. Add something Claude should remember.</span>
                </div>
              ) : (
                memory.map((m) => (
                  <div key={m.id} className="claude-memory-item">
                    <span className="claude-memory-type">{m.type}</span>
                    <span className="claude-memory-content">{m.content}</span>
                    <button
                      className="claude-memory-delete"
                      onClick={() => removeMemory(m.id)}
                      title="Delete memory"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="claude-memory-add">
              <input
                className="claude-memory-input"
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addMemory();
                }}
                placeholder="Add something Claude should remember…"
              />
              <button className="claude-memory-save" onClick={addMemory} title="Save memory">
                <Save size={13} />
              </button>
            </div>
          </div>
        ) : (
          <div className="claude-scroll">
            <Terminal />
          </div>
        )}
      </div>
    </div>
  );
}
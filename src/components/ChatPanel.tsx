import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Square, Loader2, Settings, AlertCircle } from 'lucide-react';
import { AISettings } from './AISettings';

interface Session {
  id: string;
  title: string;
  updatedAt: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const SYSTEM_PROMPT = `You are CodeCraft's AI coding assistant. You help developers read, explain, generate, debug and improve code. Be concise and precise. When showing code, wrap it in markdown code blocks with the language specified.`;

export function ChatPanel({ session }: { session: Session | null }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    (window as any).electronAPI.llmGetConfig().then((cfg: any) => {
      if (!mounted) return;
      setHasConfig(!!cfg?.hasApiKey);
    });
    return () => { mounted = false; };
  }, []);

  // Subscribe to streaming events once.
  useEffect(() => {
    const api = (window as any).electronAPI;
    const unsubStart = api.onChatStart(() => {
      setRunning(true);
    });
    const unsubChunk = api.onChatChunk((chunk: string) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, text: last.text + chunk }];
        }
        return [...prev, { id: 'a-stream', role: 'assistant', text: chunk }];
      });
    });
    const unsubDone = api.onChatDone(() => {
      setRunning(false);
    });
    const unsubError = api.onChatError((err: string) => {
      setError(err);
      setRunning(false);
    });
    return () => {
      unsubStart();
      unsubChunk();
      unsubDone();
      unsubError();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || running) return;
    if (!hasConfig) {
      setSettingsOpen(true);
      setError('Configure your LLM API key in Settings first.');
      return;
    }

    setError('');
    setMessages((prev) => [...prev, { id: 'u' + Date.now(), role: 'user', text }]);
    setInput('');
    setRunning(true);

    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    const payload = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...history,
      { role: 'user' as const, content: text }
    ];

    try {
      await (window as any).electronAPI.llmChatStream({ messages: payload });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send message.');
      setRunning(false);
    }
  };

  const stop = async () => {
    try {
      await (window as any).electronAPI.llmStopGeneration();
    } catch {}
    setRunning(false);
  };

  const handleSaveSettings = async (cfg: any) => {
    await (window as any).electronAPI.llmSaveConfig(cfg);
    setHasConfig(true);
    setSettingsOpen(false);
  };

  return (
    <div className="chat-panel">
      <div className="panel-header">
        <span className="panel-title">AGENT CHAT</span>
        <span className="panel-count">
          {session ? session.title : 'No session'}
          {!hasConfig && <span className="config-warn"> · no key</span>}
        </span>
        <button className="icon-btn" onClick={() => setSettingsOpen(!settingsOpen)} title="AI Settings">
          <Settings size={14} />
        </button>
      </div>

      {settingsOpen ? (
        <AISettings onClose={() => setSettingsOpen(false)} onSave={() => setHasConfig(true)} />
      ) : (
        <>
          <div className="chat-scroll" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="chat-empty">
                <Bot size={28} className="chat-empty-icon" />
                <span>
                  {hasConfig
                    ? 'Start a conversation with the coding agent.'
                    : 'Configure your LLM API key to begin.'}
                </span>
                {!hasConfig && (
                  <button className="link-btn" onClick={() => setSettingsOpen(true)}>
                    Open AI Settings
                  </button>
                )}
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`chat-bubble ${m.role}`}>
                  <div className="chat-avatar">
                    {m.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div className="chat-text">{m.text}</div>
                </div>
              ))
            )}
            {running && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="chat-bubble assistant">
                <div className="chat-avatar"><Bot size={14} /></div>
                <div className="chat-text typing"><Loader2 size={14} className="spin" /> Working…</div>
              </div>
            )}
            {error && (
              <div className="chat-error">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
          </div>
          <div className="chat-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={hasConfig ? 'Message the agent…' : 'Configure AI first'}
              disabled={!hasConfig}
            />
            {running ? (
              <button className="icon-btn stop" onClick={stop} title="Stop">
                <Square size={14} />
              </button>
            ) : (
              <button
                className="icon-btn send"
                onClick={send}
                title="Send"
                disabled={!hasConfig}
              >
                <Send size={14} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Square, Loader2, Settings, AlertCircle, Paperclip, X, FileText, FileCode, FileJson } from 'lucide-react';
import { AISettings } from './AISettings';
import { MarkdownRenderer } from './MarkdownRenderer';

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

const SYSTEM_PROMPT = `You are a helpful, intelligent AI assistant with a warm and natural personality.

PERSONALITY
- Friendly, conversational, and confident without arrogance.
- Occasionally witty when it fits naturally; don't force it.
- Enthusiastic about genuinely interesting topics.
- Patient with complex problems; break things down clearly.
- Adapt your tone to match the user's style.
- Avoid robotic phrasing, excessive emojis, or repetitive "happy to help" fillers.

RESPONSE LENGTH
- Answer the actual question immediately.
- Prefer concise answers; a simple question deserves a simple answer.
- Skip unnecessary introductions, summaries, or repetition.
- Use short paragraphs; bullet points only when they genuinely help.
- Only go deep when the question requires it or the user asks for detail.

RESPONSE STYLE BY CONTEXT
Casual chat: Natural, relaxed, shorter responses, humour where appropriate.
Programming: Technically accurate, properly formatted code blocks with language labels, explain key changes, include relevant examples, avoid unnecessary theory.
Troubleshooting: Identify the likely problem, give clear numbered steps, one logical step at a time when appropriate, state the expected result.
Learning/homework: Clear accessible explanations, break complex topics into manageable parts, use examples, adapt to the user's apparent knowledge level.
Creative: Imaginative and engaging; avoid generic or repetitive suggestions.

FORMATTING
- Use Markdown: headings, bold/italic, bullet/numbered lists, inline code, fenced code blocks with language labels, tables, clickable links.
- Code blocks: always include a language label for syntax highlighting.
- Prevent broken Markdown and excessive gaps.

You work inside CodeCraft, a desktop coding app. The user may be writing code, debugging, learning, or just chatting.`;

// Persist chat sessions to localStorage so they appear in the sidebar Recents list.
function saveSession(session: Session | null, messages: Message[]) {
  if (!session) return;
  try {
    const saved = localStorage.getItem('codecraft-sessions');
    const list: Session[] = saved ? JSON.parse(saved) : [];
    const idx = list.findIndex((s) => s.id === session.id);
    const entry: Session = { ...session, updatedAt: Date.now() };
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
    // Keep the most recent 50 sessions.
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    localStorage.setItem('codecraft-sessions', JSON.stringify(list.slice(0, 50)));
  } catch {}
}

export function ChatPanel({ session, initialPrompt, onInitialPromptConsumed }: { session: Session | null; initialPrompt?: string | null; onInitialPromptConsumed?: () => void }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Array<{ name: string; size: number; content: string; warning?: string }>>([]);
  const [processingAttachments, setProcessingAttachments] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    (window as any).electronAPI?.llmGetConfig().then((cfg: any) => {
      if (!mounted) return;
      setHasConfig(!!cfg?.hasApiKey);
    });
    return () => { mounted = false; };
  }, []);

  // Pick up a prompt routed from the Home screen.
  useEffect(() => {
    if (initialPrompt) setPendingPrompt(initialPrompt);
  }, [initialPrompt]);

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

  // Persist the current session to localStorage whenever messages change,
  // so it shows up in the sidebar Recents list across reloads.
  useEffect(() => {
    if (session && messages.length > 0) {
      saveSession(session, messages);
    }
  }, [messages, session]);

  // Auto-send a prompt that came from the Home screen.
  useEffect(() => {
    if (!pendingPrompt || !hasConfig || running) return;
    const text = pendingPrompt;
    setPendingPrompt(null);
    onInitialPromptConsumed?.();

    setMessages((prev) => [...prev, { id: 'u' + Date.now(), role: 'user', text }]);
    setRunning(true);

    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    const payload = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...history,
      { role: 'user' as const, content: text }
    ];

    (window as any).electronAPI?.llmChatStream({ messages: payload }).catch((err: any) => {
      setError(err?.message ?? 'Failed to send message.');
      setRunning(false);
    });
    saveSession(session, [...messages, { id: 'u' + Date.now(), role: 'user', text }]);
  }, [pendingPrompt, hasConfig, running]);

  const send = async () => {
    const text = input.trim();
    if (!text || running) return;
    if (!hasConfig) {
      setSettingsOpen(true);
      setError('Configure your LLM API key in Settings first.');
      return;
    }

    // Build user message with attachments if any
    const userMessage = buildUserMessage(text);

    setError('');
    setMessages((prev) => [...prev, { id: 'u' + Date.now(), role: 'user', text: userMessage }]);
    setInput('');
    setRunning(true);

    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    const payload = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...history,
      { role: 'user' as const, content: userMessage }
    ];

    try {
      await (window as any).electronAPI.llmChatStream({ messages: payload });
      // Clear attachments only on successful send
      clearAttachments();
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

  // Pick file icon based on extension
  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['js','jsx','ts','tsx','json','py','java','c','cpp','h','rs','go','php','sql','sh','html','css','scss','yaml','yml','xml','toml'].includes(ext)) {
      return <FileCode size={14} className="text-cyan-400" />;
    }
    if (ext === 'pdf') {
      return <FileText size={14} className="text-red-400" />;
    }
    return <FileText size={14} className="text-white/70" />;
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAttachFiles = async () => {
    const api = (window as any).electronAPI;
    if (!api?.attachmentsOpenDialog) return;
    const result = await api.attachmentsOpenDialog();
    if (!result.ok || !result.files?.length) return;

    setProcessingAttachments(true);
    const procResult = await api.attachmentsProcess(result.files);
    setProcessingAttachments(false);

    if (!procResult.ok) {
      setError(procResult.error || 'Failed to process attachments');
      return;
    }

    const valid = procResult.attachments.filter((a: any) => a.content !== undefined && !a.error);
    const errors = procResult.attachments.filter((a: any) => a.error);

    if (errors.length) {
      setError(errors.map((e: any) => `${e.name}: ${e.error}`).join('; '));
    }

    if (valid.length) {
      setAttachments(prev => [...prev, ...valid]);
    }
  };

  const removeAttachment = (name: string) => {
    setAttachments(prev => prev.filter(a => a.name !== name));
  };

  const clearAttachments = () => {
    setAttachments([]);
  };

  const buildUserMessage = (text: string) => {
    if (attachments.length === 0) return text;
    const attachmentBlocks = attachments.map(a =>
      `---FILE: ${a.name} (${formatSize(a.size)})---\n${a.content}\n---END FILE: ${a.name}---`
    ).join('\n\n');
    return `${attachmentBlocks}\n\n${text}`;
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
                {hasConfig
                  ? 'Start a conversation with the coding agent.'
                  : 'Configure your LLM API key to begin.'}
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
                  <div className="chat-text"><MarkdownRenderer text={m.text} /></div>
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
          {attachments.length > 0 && (
            <div className="chat-attachments">
              {attachments.map((a) => (
                <div key={a.name} className="chat-attachment-chip">
                  <span className="chat-attachment-icon">{getFileIcon(a.name)}</span>
                  <span className="chat-attachment-name" title={a.name}>{a.name}</span>
                  <span className="chat-attachment-size">{formatSize(a.size)}</span>
                  {a.warning && <span className="chat-attachment-warning" title={a.warning}>⚠</span>}
                  <button className="chat-attachment-remove" onClick={() => removeAttachment(a.name)} title="Remove">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="chat-input">
            <div className="chat-input-left">
              <button
                className="icon-btn attach"
                onClick={handleAttachFiles}
                disabled={processingAttachments || running || !hasConfig}
                title={processingAttachments ? 'Processing…' : 'Attach files'}
              >
                {processingAttachments ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <Paperclip size={14} />
                )}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder={hasConfig ? 'Message the agent…' : 'Configure AI first'}
                disabled={!hasConfig}
              />
            </div>
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
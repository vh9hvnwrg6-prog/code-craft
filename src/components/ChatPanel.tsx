import React, { useState } from 'react';
import { Send, Bot, User, Square, Loader2 } from 'lucide-react';

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

export function ChatPanel({ session }: { session: Session | null }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [running, setRunning] = useState(false);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { id: 'u' + Date.now(), role: 'user', text }]);
    setInput('');
    setRunning(true);
    // Stub: real agent streaming will replace this handler.
    setTimeout(() => {
      setMessages((m) => [...m, { id: 'a' + Date.now(), role: 'assistant', text: `Echo: ${text}` }]);
      setRunning(false);
    }, 600);
  };

  return (
    <div className="chat-panel">
      <div className="panel-header">
        <span className="panel-title">AGENT CHAT</span>
        <span className="panel-count">{session ? session.title : 'No session'}</span>
      </div>
      <div className="chat-scroll">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <Bot size={28} className="chat-empty-icon" />
            <span>Start a conversation with the coding agent.</span>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`chat-bubble ${m.role}`}>
              <div className="chat-avatar">{m.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}</div>
              <div className="chat-text">{m.text}</div>
            </div>
          ))
        )}
        {running && (
          <div className="chat-bubble assistant">
            <div className="chat-avatar"><Bot size={14} /></div>
            <div className="chat-text typing"><Loader2 size={14} className="spin" /> Working…</div>
          </div>
        )}
      </div>
      <div className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Message the agent…"
        />
        {running ? (
          <button className="icon-btn stop" title="Stop"><Square size={14} /></button>
        ) : (
          <button className="icon-btn send" onClick={send} title="Send"><Send size={14} /></button>
        )}
      </div>
    </div>
  );
}
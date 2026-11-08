import React, { useState, useEffect } from 'react';
import { FolderOpen, Cpu, Circle, Settings, Plug, X, Minus, Maximize2 } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  path: string;
}

interface Session {
  id: string;
  title: string;
  updatedAt: number;
}

interface ToolbarProps {
  workspace: Workspace | null;
  session: Session | null;
  onWorkspaceChange: (w: Workspace) => void;
  onSessionChange: (s: Session | null) => void;
  onOpenSettings: () => void;
}

export function Toolbar({ workspace, session, onOpenSettings }: ToolbarProps) {
  const [hasConfig, setHasConfig] = useState(false);

  useEffect(() => {
    let mounted = true;
    (window as any).electronAPI?.llmGetConfig().then((cfg: any) => {
      if (!mounted) return;
      setHasConfig(!!cfg?.hasApiKey);
    });
    return () => { mounted = false; };
  }, []);

  const handleWindowControl = (action: 'close' | 'minimize' | 'maximize') => {
    (window as any).electronAPI?.windowControl?.(action);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="window-controls" onClick={(e) => e.stopPropagation()}>
          <button className="window-btn close" onClick={() => handleWindowControl('close')} title="Close" aria-label="Close">
            <X size={10} />
          </button>
          <button className="window-btn minimize" onClick={() => handleWindowControl('minimize')} title="Minimize" aria-label="Minimize">
            <Minus size={10} />
          </button>
          <button className="window-btn maximize" onClick={() => handleWindowControl('maximize')} title="Maximize" aria-label="Maximize">
            <Maximize2 size={10} />
          </button>
        </div>
        <div className="brand">
          <div className="brand-mark"><Cpu size={16} /></div>
          <span className="brand-name">CodeCraft</span>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-item">
          <FolderOpen size={13} />
          <span className="toolbar-label">{workspace?.name ?? 'No workspace'}</span>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-item">
          <Circle size={8} className="status-dot" />
          <span className="toolbar-label">{session ? session.title : 'No active session'}</span>
        </div>
      </div>
      <div className="toolbar-right">
        <div className="agent-status">
          <span className="agent-status-text">Agent</span>
          <span className={`agent-status-pill ${hasConfig ? 'online' : 'offline'}`}>
            {hasConfig ? 'Online' : 'Offline'}
          </span>
          <span className="agent-status-icon">
            {hasConfig ? <Plug size={11} /> : <Settings size={11} />}
          </span>
        </div>
        <button className="icon-btn" onClick={onOpenSettings} title="AI Settings">
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}
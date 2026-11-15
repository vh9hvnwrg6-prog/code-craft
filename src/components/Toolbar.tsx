import React, { useState, useEffect } from 'react';
import { FolderOpen, Circle, Settings, Plug, X, Minus, Maximize2, ChevronDown, Home } from 'lucide-react';

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
  view: 'home' | 'workspace';
  onWorkspaceChange: (w: Workspace) => void;
  onSessionChange: (s: Session | null) => void;
  onOpenSettings: () => void;
  onGoHome: () => void;
}

export function Toolbar({ workspace, session, view, onOpenSettings, onGoHome }: ToolbarProps) {
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
    <div className="top-bar">
      <div className="top-bar-left">
        <div className="window-controls" onClick={(e) => e.stopPropagation()}>
          <button className="window-btn close" onClick={() => handleWindowControl('close')} title="Close" aria-label="Close">
            <X size={12} />
          </button>
          <button className="window-btn minimize" onClick={() => handleWindowControl('minimize')} title="Minimize" aria-label="Minimize">
            <Minus size={12} />
          </button>
          <button className="window-btn maximize" onClick={() => handleWindowControl('maximize')} title="Maximize" aria-label="Maximize">
            <Maximize2 size={12} />
          </button>
        </div>
        <div className="brand">
          <div className="brand-mark"><Home size={15} /></div>
          <span className="brand-name">CodeCraft</span>
        </div>
        <div className="app-title-select" title="Active project">
          <span>{workspace?.name ?? 'No workspace'}</span>
          <ChevronDown size={12} />
        </div>
        <div className="app-title-select" title="Active session">
          <Circle size={7} className="status-dot" />
          <span>{session ? session.title : 'No session'}</span>
        </div>
        {view === 'workspace' && (
          <button className="icon-btn" onClick={onGoHome} title="Home">
            <Home size={13} />
          </button>
        )}
      </div>
      <div className="top-bar-right">
        <div className="agent-status">
          <span className="agent-status-text">Agent</span>
          <span className={`agent-status-pill ${hasConfig ? 'online' : 'offline'}`}>
            {hasConfig ? 'Online' : 'Offline'}
          </span>
          <span className="agent-status-icon">
            {hasConfig ? <Plug size={11} /> : <Settings size={11} />}
          </span>
        </div>
        <button className="icon-btn" onClick={onOpenSettings} title="Settings & Preferences">
          <Settings size={15} />
        </button>
      </div>
    </div>
  );
}
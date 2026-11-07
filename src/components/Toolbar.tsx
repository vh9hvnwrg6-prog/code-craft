import React from 'react';
import { FolderOpen, Cpu, Circle } from 'lucide-react';

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
}

export function Toolbar({ workspace, session }: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
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
          <span className="agent-status-pill">Idle</span>
        </div>
      </div>
    </div>
  );
}
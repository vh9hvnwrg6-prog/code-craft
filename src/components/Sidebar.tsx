import React from 'react';
import { FolderOpen, MessageSquare, Settings, History, Plus, Search } from 'lucide-react';

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

interface SidebarProps {
  workspaces: Workspace[];
  sessions: Session[];
  activeWorkspace: Workspace | null;
  activeSession: Session | null;
  collapsed: boolean;
  onToggle: () => void;
  onWorkspaceSelect: (w: Workspace) => void;
  onSessionSelect: (s: Session) => void;
}

export function Sidebar({ workspaces, sessions, activeWorkspace, activeSession, collapsed, onToggle, onWorkspaceSelect, onSessionSelect }: SidebarProps) {
  if (collapsed) {
    return (
      <div className="sidebar sidebar-collapsed">
        <button className="icon-btn" onClick={onToggle} title="Open sidebar">
          <FolderOpen size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">NAVIGATION</span>
        <button className="icon-btn" onClick={onToggle} title="Collapse">
          <FolderOpen size={14} />
        </button>
      </div>

      <div className="sidebar-section">
        <div className="section-label">
          <FolderOpen size={12} />
          <span>WORKSPACES</span>
        </div>
        <button className="section-add" title="Open folder">
          <Plus size={12} />
        </button>
        {workspaces.map((w) => (
          <div
            key={w.id}
            className={`sidebar-item ${activeWorkspace?.id === w.id ? 'active' : ''}`}
            onClick={() => onWorkspaceSelect(w)}
          >
            <FolderOpen size={14} />
            <span className="item-text">
              <span className="item-name">{w.name}</span>
              <span className="item-sub">{w.path}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="section-label">
          <History size={12} />
          <span>SESSIONS</span>
        </div>
        <button className="section-add" title="New session">
          <Plus size={12} />
        </button>
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`sidebar-item ${activeSession?.id === s.id ? 'active' : ''}`}
            onClick={() => onSessionSelect(s)}
          >
            <MessageSquare size={14} />
            <span className="item-text">
              <span className="item-name">{s.title}</span>
              <span className="item-sub">{new Date(s.updatedAt).toLocaleDateString()}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="sidebar-section sidebar-footer">
        <div className="section-label">
          <Settings size={12} />
          <span>SETTINGS</span>
        </div>
        <div className="sidebar-item" onClick={() => {}}>
          <Settings size={14} />
          <span className="item-text"><span className="item-name">Preferences</span></span>
        </div>
      </div>
    </div>
  );
}
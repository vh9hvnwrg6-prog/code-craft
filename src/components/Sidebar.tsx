import React, { useState, useEffect } from 'react';
import { FolderOpen, Settings, Plus, Search, House } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  path: string;
}

interface SidebarProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  collapsed: boolean;
  onToggle: () => void;
  onWorkspaceSelect: (w: Workspace) => void;
  onHome: () => void;
  onOpenSettings: () => void;
  userName?: string;
}

export function Sidebar({ workspaces, activeWorkspace, collapsed, onToggle, onWorkspaceSelect, onHome, onOpenSettings, userName }: SidebarProps) {
  const [name, setName] = useState(userName || 'Alfie Sumner');

  // Read the saved display name from onboarding. Falls back to the
  // hardcoded default if nothing is stored yet.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res: any = await (window as any).electronAPI?.onboardingGet?.();
        if (mounted && res?.ok && res.config?.userName) {
          setName(res.config.userName);
        }
      } catch {
        // IPC unavailable — keep the default.
      }
    })();
    return () => { mounted = false; };
  }, []);

  const displayName = (userName || name || 'Alfie Sumner').trim() || 'Alfie Sumner';
  const initial = displayName.charAt(0).toUpperCase() || 'A';

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button className="sidebar-home" onClick={onHome} title="Home">
          <House size={14} />
          <span>Home</span>
        </button>
        <button className="icon-btn" onClick={onToggle} title="Collapse sidebar">
          <FolderOpen size={14} />
        </button>
      </div>

      <div className="sidebar-section" style={{ paddingTop: 4 }}>
        <button className="sidebar-item" style={{ fontWeight: 600 }} onClick={() => onHome && onHome()}>
          <Plus size={16} />
          <span>New</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#6b6b80' }}>⌘N</span>
        </button>
        <div className="sidebar-search">
          <Search size={13} />
          <input placeholder="Search" readOnly />
        </div>
      </div>

      <div className="sidebar-section">
        <div className="section-label">
          <FolderOpen size={13} />
          <span>Projects</span>
          <button className="section-add" title="Open folder">
            <Plus size={12} />
          </button>
        </div>
        {workspaces.map((w) => (
          <div
            key={w.id}
            className={`sidebar-item ${activeWorkspace?.id === w.id ? 'active' : ''}`}
            onClick={() => onWorkspaceSelect(w)}
          >
            <FolderOpen size={15} />
            <span className="item-text">
              <span className="item-name">{w.name}</span>
              <span className="item-sub">{w.path}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="sidebar-section sidebar-footer">
        <div className="section-label">
          <Settings size={13} />
          <span>Settings</span>
        </div>
        <div className="sidebar-item" onClick={onOpenSettings}>
          <Settings size={15} />
          <span className="item-text"><span className="item-name">Preferences</span></span>
        </div>
        <div className="sidebar-item" style={{ marginTop: 4 }}>
          <div className="user-avatar">A</div>
          <span className="item-text">
            <span className="item-name">Alfie Sumner</span>
            <span className="item-sub">Free</span>
          </span>
        </div>
      </div>
    </div>
  );
}
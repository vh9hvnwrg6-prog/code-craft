import React, { useState, useEffect, useRef } from 'react';
import { Folder, File, ChevronRight, ChevronDown, X, Plus, Trash2, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  children?: TreeNode[];
}

interface FileTreeProps {
  tree: TreeNode[];
  openFiles: string[];
  activeFile: string | null;
  explorerOpen: boolean;
  onToggleExplorer: () => void;
  onTreeChange?: (tree: any[]) => void;
  onFileOpen: (path: string) => void;
  onFileClose: (path: string) => void;
  onFileSelect: (path: string) => void;
  onFileDeleted?: (path: string) => void;
}

function NodeRow({
  node,
  depth,
  isActive,
  expanded,
  onToggle,
  onClick,
  loading,
}: {
  node: TreeNode;
  depth: number;
  isActive: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
  onClick: (path: string) => void;
  loading: Record<string, boolean>;
}) {
  const Icon = node.type === 'folder' ? Folder : File;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isLoading = loading[node.id];
  return (
    <div
      className={`tree-node ${isActive ? 'active' : ''} ${node.type === 'file' ? 'tree-file' : ''}`}
      style={{ paddingLeft: 14 + depth * 13 }}
      onClick={() => (node.type === 'folder' ? onToggle(node.id) : onClick(node.path))}
    >
      {hasChildren && (
        <span className="tree-chevron">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      )}
      {!hasChildren && <span className="tree-chevron spacer" />}
      <Icon size={13} className="tree-icon" />
      <span className="tree-name">{node.name}</span>
      {node.type === 'file' && isActive && (
        <X size={11} className="tree-close" onClick={(e) => { e.stopPropagation(); }} />
      )}
      {isLoading && <span className="tree-loading">…</span>}
    </div>
  );
}

export function FileTree({ tree, openFiles, activeFile, explorerOpen, onToggleExplorer, onTreeChange, onFileOpen, onFileClose, onFileSelect, onFileDeleted }: FileTreeProps) {
  const openSet = new Set(openFiles);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createProject = async () => {
    const name = prompt('Project name:', '');
    if (!name || !name.trim()) return;
    setLoading({ ...loading, ['vault-create']: true });
    try {
      const result = await (window as any).electronAPI?.fsCreateProject(name.trim());
      setLoading({ ...loading, ['vault-create']: false });
      if (!result.ok) {
        alert(result.error ?? 'Failed to create project.');
        return;
      }
      const vault = await (window as any).electronAPI?.fsOpenVault();
      if (vault?.ok && onTreeChange) onTreeChange(vault.tree);
    } catch (err: any) {
      setLoading({ ...loading, ['vault-create']: false });
      alert(err?.message ?? 'Failed to create project.');
    }
  };

  const createFolder = async (parentPath: string) => {
    const name = window.prompt('New folder name:', '');
    if (!name || !name.trim()) return;
    setLoading({ ...loading, [parentPath]: true });
    try {
      const result = await (window as any).electronAPI?.fsCreateFolder(parentPath, name.trim());
      setLoading({ ...loading, [parentPath]: false });
      if (!result.ok) {
        alert(result.error ?? 'Failed to create folder.');
        return;
      }
      const vault = await (window as any).electronAPI?.fsOpenVault();
      if (vault?.ok && onTreeChange) onTreeChange(vault.tree);
    } catch (err: any) {
      setLoading({ ...loading, [parentPath]: false });
      alert(err?.message ?? 'Failed to create folder.');
    }
  };

  const createFile = async (parentPath: string) => {
    const name = window.prompt('New file name:', '');
    if (!name || !name.trim()) return;
    setLoading({ ...loading, [parentPath]: true });
    try {
      const result = await (window as any).electronAPI?.fsCreateFile(parentPath, name.trim());
      setLoading({ ...loading, [parentPath]: false });
      if (!result.ok) {
        alert(result.error ?? 'Failed to create file.');
        return;
      }
      const vault = await (window as any).electronAPI?.fsOpenVault();
      if (vault?.ok && onTreeChange) onTreeChange(vault.tree);
    } catch (err: any) {
      setLoading({ ...loading, [parentPath]: false });
      alert(err?.message ?? 'Failed to create file.');
    }
  };

  const deleteNode = async (path: string) => {
    if (!window.confirm(`Delete ${path.split('/').pop()}?`)) return;
    setLoading({ ...loading, [path]: true });
    try {
      const result = await (window as any).electronAPI?.fsDelete(path);
      setLoading({ ...loading, [path]: false });
      if (!result.ok) {
        alert(result.error ?? 'Failed to delete.');
        return;
      }
      const vault = await (window as any).electronAPI?.fsOpenVault();
      if (vault?.ok) {
        if (onTreeChange) onTreeChange(vault.tree);
        if (onFileDeleted) onFileDeleted(path);
      }
    } catch (err: any) {
      setLoading({ ...loading, [path]: false });
      alert(err?.message ?? 'Failed to delete.');
    }
  };

  const renderTree = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const isActive = activeFile === node.path;
      const expanded = node.type === 'folder' && expandedFolders.has(node.id);
      const children =
        node.type === 'folder' && expanded && Array.isArray(node.children)
          ? renderTree(node.children, depth + 1)
          : null;

      return (
        <div key={node.id}>
          <NodeRow
            node={node}
            depth={depth}
            isActive={isActive}
            expanded={expanded}
            onToggle={toggleFolder}
            onClick={onFileOpen}
            loading={loading}
          />
          {children}
          {node.type === 'folder' && expanded && (
            <div className="tree-footer" style={{ paddingLeft: 14 + depth * 13 }}>
              <button className="tree-action" onClick={(e) => { e.stopPropagation(); createFolder(node.path); }} title="New folder">
                <Plus size={11} />
              </button>
              <button className="tree-action" onClick={(e) => { e.stopPropagation(); createFile(node.path); }} title="New file">
                <File size={11} />
              </button>
              <button className="tree-action delete" onClick={(e) => { e.stopPropagation(); deleteNode(node.path); }} title="Delete">
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="file-tree-panel">
      <div className="panel-header">
        <div className="panel-title-row">
          <span className="panel-title">EXPLORER</span>
          <span className="panel-count">{openSet.size}</span>
        </div>
        <div className="panel-actions">
          <button className="icon-btn-sm" onClick={createProject} title="New project">
            <Plus size={13} />
          </button>
          <button className="icon-btn-sm" onClick={onToggleExplorer} title="Toggle explorer">
            {explorerOpen ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
          </button>
        </div>
      </div>
      <div className="tree-scroll">
        {renderTree(tree, 0)}
      </div>
      {openFiles.length > 0 && (
        <div className="open-tabs">
          {openFiles.map((p) => (
            <div key={p} className={`open-tab ${activeFile === p ? 'active' : ''}`} onClick={() => onFileSelect(p)}>
              <File size={12} />
              <span>{p.split('/').pop()}</span>
              <X size={11} className="tab-close" onClick={(e) => { e.stopPropagation(); onFileClose(p); }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
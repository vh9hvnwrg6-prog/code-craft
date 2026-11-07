import React from 'react';
import { Folder, File, ChevronRight, ChevronDown, X } from 'lucide-react';

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
  onFileOpen: (path: string) => void;
  onFileClose: (path: string) => void;
  onFileSelect: (path: string) => void;
}

function NodeRow({ node, depth, isActive, onClick }: { node: TreeNode; depth: number; isActive: boolean; onClick: () => void }) {
  const Icon = node.type === 'folder' ? Folder : File;
  return (
    <div
      className={`tree-node ${isActive ? 'active' : ''}`}
      style={{ paddingLeft: 12 + depth * 14 }}
      onClick={onClick}
    >
      <span className="tree-chevron"><ChevronRight size={12} /></span>
      <Icon size={14} className="tree-icon" />
      <span className="tree-name">{node.name}</span>
      {isActive && <X size={11} className="tree-close" onClick={(e) => { e.stopPropagation(); }} />}
    </div>
  );
}

export function FileTree({ tree, openFiles, activeFile, onFileOpen, onFileClose, onFileSelect }: FileTreeProps) {
  const openSet = new Set(openFiles);
  return (
    <div className="file-tree-panel">
      <div className="panel-header">
        <span className="panel-title">EXPLORER</span>
        <span className="panel-count">{openSet.size}</span>
      </div>
      <div className="tree-scroll">
        {tree.map((node) => (
          <NodeRow key={node.id} node={node} depth={0} isActive={activeFile === node.path} onClick={() => onFileOpen(node.path)} />
        ))}
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
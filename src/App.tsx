import React, { useState } from 'react';
import { FileTree } from './components/FileTree';
import { Editor } from './components/Editor';
import { ChatPanel } from './components/ChatPanel';
import { ActivityPanel } from './components/ActivityPanel';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import './styles.css';

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

const SAMPLE_WORKSPACES: Workspace[] = [
  { id: 'ws-1', name: 'CodeCraft', path: '/Users/alfie/CodeCraft' },
  { id: 'ws-2', name: 'Hello-World', path: '/Users/alfie/hello-world' }
];

const SAMPLE_SESSIONS: Session[] = [
  { id: 's-1', title: 'Initial setup', updatedAt: Date.now() - 3600000 },
  { id: 's-2', title: 'Fix auth flow', updatedAt: Date.now() - 7200000 }
];

const SAMPLE_TREE = [
  {
    id: '1',
    name: 'CodeCraft',
    type: 'folder' as const,
    path: '/Users/alfie/CodeCraft',
    children: [
      { id: '2', name: 'package.json', type: 'file' as const, path: '/Users/alfie/CodeCraft/package.json' },
      { id: '3', name: 'main.ts', type: 'file' as const, path: '/Users/alfie/CodeCraft/main.ts' },
      {
        id: '4', name: 'src', type: 'folder' as const, path: '/Users/alfie/CodeCraft/src',
        children: [
          { id: '5', name: 'main.tsx', type: 'file' as const, path: '/Users/alfie/CodeCraft/src/main.tsx' },
          { id: '6', name: 'styles.css', type: 'file' as const, path: '/Users/alfie/CodeCraft/src/styles.css' }
        ]
      }
    ]
  }
];

export default function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(SAMPLE_WORKSPACES[0]);
  const [activeSession, setActiveSession] = useState<Session | null>(SAMPLE_SESSIONS[0]);
  const [tree, setTree] = useState(SAMPLE_TREE);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activityOpen, setActivityOpen] = useState(true);

  return (
    <div className="app-root">
      <Toolbar
        workspace={activeWorkspace}
        session={activeSession}
        onWorkspaceChange={setActiveWorkspace}
        onSessionChange={setActiveSession}
      />
      <div className="app-body">
        <Sidebar
          workspaces={SAMPLE_WORKSPACES}
          sessions={SAMPLE_SESSIONS}
          activeWorkspace={activeWorkspace}
          activeSession={activeSession}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onWorkspaceSelect={setActiveWorkspace}
          onSessionSelect={setActiveSession}
        />
        <div className="main-column">
          <FileTree
            tree={tree}
            openFiles={openFiles}
            activeFile={activeFile}
            onFileOpen={(p) => {
              setOpenFiles((prev) => [...new Set([...prev, p])]);
              setActiveFile(p);
            }}
            onFileClose={(p) => {
              setOpenFiles((prev) => prev.filter((f) => f !== p));
              if (activeFile === p) setActiveFile(openFiles[openFiles.length - 2] || null);
            }}
            onFileSelect={setActiveFile}
          />
          <Editor openFiles={openFiles} activeFile={activeFile} />
        </div>
        <div className="right-column">
          <ChatPanel session={activeSession} />
          <ActivityPanel open={activityOpen} onToggle={() => setActivityOpen(!activityOpen)} />
        </div>
      </div>
    </div>
  );
}
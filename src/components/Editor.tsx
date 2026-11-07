import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface EditorProps {
  openFiles: string[];
  activeFile: string | null;
}

const SAMPLE_CONTENT: Record<string, string> = {
  '/Users/alfie/CodeCraft/main.ts': `import { app, BrowserWindow } from 'electron';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL('http://localhost:5173');
}

app.whenReady().then(createWindow);
`,
  '/Users/alfie/CodeCraft/src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';

export default function App() {
  return <div>Hello CodeCraft</div>;
}
`,
  '/Users/alfie/CodeCraft/package.json': `{
  "name": "codecraft",
  "version": "0.1.0"
}
`
};

export function Editor({ openFiles, activeFile }: EditorProps) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (activeFile) {
      setContent(SAMPLE_CONTENT[activeFile] ?? '// (no preview available)');
    }
  }, [activeFile]);

  if (!activeFile) {
    return (
      <div className="editor-empty">
        <div className="editor-empty-inner">
          <span className="editor-empty-title">No file open</span>
          <span className="editor-empty-hint">Select a file from the explorer to begin editing.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-wrap">
      <div className="editor-tabbar">
        {openFiles.map((p) => (
          <div key={p} className={`editor-tab ${p === activeFile ? 'active' : ''}`}>
            <span>{p.split('/').pop()}</span>
          </div>
        ))}
      </div>
      <textarea
        ref={taRef}
        className="editor-textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
      />
      <div className="editor-statusbar">
        <span>{activeFile.split('/').pop()}</span>
        <span>Ln {content.split('\n').findIndex((l, i) => l.length >= 0 && i === 0) + 1}, Col 1</span>
        <span className={saving ? 'saving' : 'saved'}>{saving ? 'Saving…' : 'Saved'}</span>
      </div>
    </div>
  );
}
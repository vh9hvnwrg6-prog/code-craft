import React, { useEffect, useRef, useState } from 'react';

interface EditorProps {
  openFiles: string[];
  activeFile: string | null;
}

const SAMPLE_CONTENT: Record<string, string> = {
  'main.ts': `import { app, BrowserWindow } from 'electron';

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
  'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';

export default function App() {
  return <div>Hello CodeCraft</div>;
}
`,
  'package.json': `{
  "name": "codecraft",
  "version": "0.1.0"
}
`
};

export function Editor({ openFiles, activeFile }: EditorProps) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Load the file from disk (via the main process) when the active file changes.
  useEffect(() => {
    let mounted = true;
    if (!activeFile) {
      setContent('');
      setLoaded(false);
      return;
    }
    const api = (window as any).electronAPI;
    if (!api?.fsReadFile) {
      setContent('// (no file API available)');
      setLoaded(true);
      return;
    }
    api.fsReadFile(activeFile).then((res: any) => {
      if (!mounted) return;
      if (res?.ok) {
        setContent(res.content);
      } else {
        setContent(`// ${res?.error ?? 'Could not read file'}`);
      }
      setLoaded(true);
    });
    return () => { mounted = false; };
  }, [activeFile]);

  // Save back to disk when the user stops typing.
  useEffect(() => {
    if (!activeFile || !loaded) return;
    const api = (window as any).electronAPI;
    if (!api?.fsWriteFile) return;
    const t = setTimeout(() => {
      setSaving(true);
      api.fsWriteFile(activeFile, content).then((res: any) => {
        setSaving(false);
        if (!res?.ok) console.error('[editor] save failed:', res?.error);
      });
    }, 400);
    return () => clearTimeout(t);
  }, [content, activeFile, loaded]);

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
        <span>Ln 1, Col 1</span>
        <span className={saving ? 'saving' : 'saved'}>{saving ? 'Saving…' : 'Saved'}</span>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useCallback } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { ClaudeCodePanel } from './components/ClaudeCodePanel';
import { ActivityPanel } from './components/ActivityPanel';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { Home } from './components/Home';
import { OnboardingScreen } from './components/OnboardingScreen';
import { SettingsModal } from './components/SettingsModal';
import { loadPrefs, applyPrefs, savePrefs, type ThemeId, DEFAULT_PREFS } from './theme';
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
  { id: 'ws-1', name: 'CodeCraft', path: '~/CodeCraft' },
  { id: 'ws-2', name: 'Hello-World', path: '~/hello-world' }
];

const SAMPLE_SESSIONS: Session[] = [
  { id: 's-1', title: 'Initial setup', updatedAt: Date.now() - 3600000 },
  { id: 's-2', title: 'Fix auth flow', updatedAt: Date.now() - 7200000 }
];

type View = 'home' | 'workspace';

interface OnboardingConfig {
  userName: string;
  theme: ThemeId;
  animationsEnabled: boolean;
  responseStyle: 'concise' | 'balanced' | 'detailed';
  completed?: boolean;
}

export default function App() {
  const [view, setView] = useState<View>('home');
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(SAMPLE_WORKSPACES[0]);
  const [activeSession, setActiveSession] = useState<Session | null>(SAMPLE_SESSIONS[0]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activityOpen, setActivityOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'chat' | 'claude-code'>('claude-code');
  const [homeReady, setHomeReady] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingConfig | null>(null);
  const [onboardingReady, setOnboardingReady] = useState(false);

  // Apply the saved theme immediately on startup.
  useEffect(() => {
    applyPrefs(loadPrefs());
  }, []);

  // Load first-run onboarding state. If incomplete, show the setup screen;
  // otherwise the app proceeds to the normal Home/landing view.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res: any = await (window as any).electronAPI?.onboardingGet?.();
        if (mounted && res?.ok && res.config) {
          setOnboarding(res.config);
        }
      } catch {
        // IPC unavailable (e.g. outside Electron) — proceed to the app.
      } finally {
        if (mounted) setOnboardingReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /** Persist the onboarding choices and mark setup complete. */
  const handleOnboardingComplete = async (config: OnboardingConfig) => {
    try {
      await (window as any).electronAPI?.onboardingSetName?.(config.userName);
      await (window as any).electronAPI?.onboardingSetPreferences?.({
        theme: config.theme,
        animationsEnabled: config.animationsEnabled,
        responseStyle: config.responseStyle,
      });
      await (window as any).electronAPI?.onboardingComplete?.();
    } catch {
      // Best‑effort — the UI state still advances below.
    }
    // Mark as completed locally so the gating UI updates immediately.
    const completedConfig = { ...config, completed: true };
    setOnboarding(completedConfig);
    // Apply the chosen theme immediately.
    savePrefs({ theme: config.theme, accent: DEFAULT_PREFS.accent, fontSize: DEFAULT_PREFS.fontSize });
  };

  const handleHomeAction = (action: 'create' | 'fix' | 'explain' | 'workspace') => {
    setView('workspace');
  };

  // Open a previously saved chat session (opens in Claude Code with its logs).
  const handleOpenSession = (sessionId: string) => {
    const saved = (() => {
      try {
        const raw = localStorage.getItem('codecraft-sessions');
        return raw ? (JSON.parse(raw) as Session[]) : [];
      } catch {
        return [];
      }
    })();
    const all = [...SAMPLE_SESSIONS, ...saved];
    const session = all.find((s) => s.id === sessionId);
    if (session) setActiveSession(session);
    setAiMode('claude-code');
    setView('workspace');
  };

  const handleLaunchMode = (mode: 'chat' | 'claude-code') => {
    setAiMode(mode);
    setView('workspace');
  };

  // Called when the welcome intro finishes — fade the toolbar in.
  // Wrapped in useCallback so the Home intro effect doesn't re-run
  // (which would reset the stage and replay the whole sequence).
  const handleIntroComplete = useCallback(() => {
    setHomeReady(true);
  }, []);

  // Gate the app behind first-run onboarding until it is completed.
  const needsOnboarding = onboardingReady && onboarding && !onboarding.completed;

  return (
    <div className={`app-root ${homeReady ? 'home-ready' : ''}`}>
      {needsOnboarding ? (
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      ) : (
        <>
          <Toolbar
            workspace={activeWorkspace}
            session={activeSession}
            view={view}
            onWorkspaceChange={setActiveWorkspace}
            onSessionChange={setActiveSession}
            onOpenSettings={() => setSettingsOpen(true)}
            onGoHome={() => setView('home')}
          />

      {view === 'home' ? (
        <Home
          onAction={handleHomeAction}
          onOpenSession={handleOpenSession}
          onLaunchMode={handleLaunchMode}
          onIntroComplete={handleIntroComplete}
        />
      ) : (
        <div className="app-body view-enter">
          <Sidebar
            workspaces={SAMPLE_WORKSPACES}
            activeWorkspace={activeWorkspace}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            onWorkspaceSelect={setActiveWorkspace}
            onHome={() => setView('home')}
            onOpenSettings={() => setSettingsOpen(true)}
            userName={onboarding?.userName}
          />
          <div className="main-column">
            <div className="ai-mode-tabs">
              <button
                className={`ai-mode-tab ${aiMode === 'claude-code' ? 'active' : ''}`}
                onClick={() => setAiMode('claude-code')}
              >
                <span>Claude Code</span>
              </button>
              <button
                className={`ai-mode-tab ${aiMode === 'chat' ? 'active' : ''}`}
                onClick={() => setAiMode('chat')}
              >
                <span>FreeLLM Chat</span>
              </button>
            </div>
            {/* Keep both panels mounted so Claude Code's PTY session
                survives switching to/from FreeLLM Chat. */}
            <div className={aiMode === 'claude-code' ? 'ai-panel-visible' : 'ai-panel-hidden'}>
              <ClaudeCodePanel session={activeSession} />
            </div>
            <div className={aiMode === 'chat' ? 'ai-panel-visible' : 'ai-panel-hidden'}>
              <ChatPanel session={activeSession} />
            </div>
            <ActivityPanel open={activityOpen} onToggle={() => setActivityOpen(!activityOpen)} />
          </div>
        </div>
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  )}
    </div>
  );
}
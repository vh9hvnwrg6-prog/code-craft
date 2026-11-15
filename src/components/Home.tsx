import React, { useState, useEffect } from 'react';
import { Brain, Sparkles } from 'lucide-react';
import logo from '../assets/codecraft-logo.png';

interface HomeProps {
  onAction: (action: 'create' | 'fix' | 'explain' | 'workspace') => void;
  onOpenSession?: (sessionId: string) => void;
  /** Launch straight into a mode (no prompt). */
  onLaunchMode?: (mode: 'chat' | 'claude-code') => void;
  /** Called once the welcome intro finishes (~3.4s). */
  onIntroComplete?: () => void;
}

export function Home({ onAction, onOpenSession, onLaunchMode, onIntroComplete }: HomeProps) {
  const [stage, setStage] = useState(0);

  // Sequenced welcome animation.
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 0);    // logo fade + scale
    const t2 = setTimeout(() => setStage(2), 800);  // logo slides up
    const t3 = setTimeout(() => setStage(3), 1450); // title + subtitle fade in
    const t4 = setTimeout(() => setStage(4), 2200); // cards rise
    const t5 = setTimeout(() => onIntroComplete?.(), 3400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onIntroComplete]);

  const launch = (mode: 'chat' | 'claude-code') => {
    if (onLaunchMode) onLaunchMode(mode);
    else onAction('workspace');
  };

  return (
    <div className={`home-root home-intro stage-${stage}`}>
      <div className="home-intro-bg" />

      {/* CodeCraft logo */}
      <div className="home-logo">
        <img src={logo} alt="CodeCraft" />
      </div>

      {/* App name */}
      <div className="home-intro-title">CodeCraft</div>

      {/* Tagline */}
      <div className="home-intro-sub">What should we work on?</div>

      {/* Mode cards */}
      <div className="home-cards">
        <button
          className="home-card home-card-a"
          onClick={() => launch('claude-code')}
          title="Start an interactive Claude Code session"
        >
          <div className="home-card-icon home-card-icon-claude">
            <Brain size={26} />
          </div>
          <div className="home-card-body">
            <span className="home-card-title">Claude Code</span>
            <span className="home-card-sub">Full agent · terminal · files</span>
          </div>
        </button>

        <button
          className="home-card home-card-b"
          onClick={() => launch('chat')}
          title="Chat with the FreeLLM API assistant"
        >
          <div className="home-card-icon home-card-icon-chat">
            <Sparkles size={26} />
          </div>
          <div className="home-card-body">
            <span className="home-card-title">FreeLLM API</span>
            <span className="home-card-sub">Quick questions · explain code</span>
          </div>
        </button>
      </div>
    </div>
  );
}
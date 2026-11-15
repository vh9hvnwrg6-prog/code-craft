import React, { useState, useEffect } from 'react';
import { Check, Sparkles, Brain, Type, ToggleRight, ToggleLeft, ArrowRight } from 'lucide-react';
import logo from '../assets/codecraft-logo.png';
import { THEMES, savePrefs, type ThemeId, DEFAULT_PREFS } from '../theme';

interface OnboardingConfig {
  userName: string;
  theme: ThemeId;
  animationsEnabled: boolean;
  responseStyle: 'concise' | 'balanced' | 'detailed';
}

const RESPONSE_STYLES: { id: OnboardingConfig['responseStyle']; label: string; sub: string }[] = [
  { id: 'concise', label: 'Concise', sub: 'Short, direct answers' },
  { id: 'balanced', label: 'Balanced', sub: 'Thorough but to the point' },
  { id: 'detailed', label: 'Detailed', sub: 'Full explanations with context' },
];

/**
 * First-run setup. Progressive reveal — each choice slides up in turn, so the
 * screen feels like it's growing rather than dumping a form at you.
 * After "Get started" it transitions to a welcome screen that runs the same
 * startup animation the Home landing already has.
 */
export function OnboardingScreen({ onComplete }: { onComplete: (config: OnboardingConfig) => void }) {
  const [stage, setStage] = useState(0);
  const [name, setName] = useState('');
  const [theme, setTheme] = useState<ThemeId>('midnight');
  const [style, setStyle] = useState<OnboardingConfig['responseStyle']>('balanced');
  const [animations, setAnimations] = useState(true);
  const [welcome, setWelcome] = useState(false);

  // Sequenced entrance — logo, then title, then the name field.
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 0);
    const t2 = setTimeout(() => setStage(2), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const canContinue = name.trim().length > 0;

  // Apply the theme live as soon as it's picked, so the background and
  // glow respond immediately instead of waiting for "Get started".
  const pickTheme = (t: ThemeId) => {
    setTheme(t);
    savePrefs({ theme: t, accent: DEFAULT_PREFS.accent, fontSize: DEFAULT_PREFS.fontSize });
  };

  const complete = () => {
    const config: OnboardingConfig = {
      userName: name.trim(),
      theme,
      animationsEnabled: animations,
      responseStyle: style,
    };
    // Persist theme prefs immediately so the rest of the app picks them up.
    savePrefs({ theme, accent: DEFAULT_PREFS.accent, fontSize: DEFAULT_PREFS.fontSize });
    // Hold a beat on the welcome screen so it reads as its own moment, then
    // hand off to the app — which runs the startup animation on the Home view.
    setWelcome(true);
    setTimeout(() => onComplete(config), 2600);
  };

  return (
    <div className={`onboarding-root onboarding-intro stage-${stage} ${welcome ? 'onboarding-welcome' : ''}`} data-theme={theme}>
      <div className="onboarding-bg" />

      {welcome ? (
        <div className="onboarding-welcome-card">
          <div className="onboarding-logo">
            <img src={logo} alt="CodeCraft" />
          </div>
          <div className="onboarding-title">Welcome to CodeCraft</div>
          <div className="onboarding-sub">Nice to meet you, {name.trim() || 'there'}.</div>
        </div>
      ) : (
      <div className="onboarding-card">
        {/* Logo + title */}
        <div className="onboarding-hero onboarding-step onboarding-step-1">
          <div className="onboarding-logo">
            <img src={logo} alt="CodeCraft" />
          </div>
          <div className="onboarding-title">CodeCraft</div>
          <div className="onboarding-sub">Let's set up your IDE</div>
        </div>

        {/* Name */}
        <div className="onboarding-field onboarding-step onboarding-step-2">
          <label className="onboarding-label" htmlFor="onboarding-name">
            What should we call you?
          </label>
          <input
            id="onboarding-name"
            className="onboarding-input"
            type="text"
            value={name}
            autoFocus
            placeholder="Your name"
            maxLength={32}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canContinue) complete();
            }}
          />
        </div>

        {/* Theme */}
        <div className="onboarding-field onboarding-step onboarding-step-3">
          <div className="onboarding-label-row">
            <Type size={13} className="onboarding-label-icon" />
            <span className="onboarding-label">Theme</span>
          </div>
          <div className="onboarding-swatch-row">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`onboarding-swatch ${theme === t.id ? 'onboarding-swatch-active' : ''}`}
                onClick={() => pickTheme(t.id)}
                title={t.name}
                aria-label={t.name}
                style={{ ['--swatch-bg' as any]: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]}, ${t.swatch[2]})` }}
              >
                <span className="onboarding-swatch-dots" />
                <span className="onboarding-swatch-name">{t.name}</span>
                {theme === t.id && <Check size={12} className="onboarding-swatch-check" />}
              </button>
            ))}
          </div>
        </div>

        {/* Response style */}
        <div className="onboarding-field onboarding-step onboarding-step-4">
          <div className="onboarding-label-row">
            <Brain size={13} className="onboarding-label-icon" />
            <span className="onboarding-label">Response style</span>
          </div>
          <div className="onboarding-segmented">
            {RESPONSE_STYLES.map((s) => (
              <button
                key={s.id}
                className={`onboarding-seg ${style === s.id ? 'onboarding-seg-active' : ''}`}
                onClick={() => setStyle(s.id)}
              >
                <span className="onboarding-seg-title">{s.label}</span>
                <span className="onboarding-seg-sub">{s.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Animations toggle */}
        <div className="onboarding-field onboarding-field-row">
          <div className="onboarding-label-row">
            {animations ? (
              <ToggleRight size={13} className="onboarding-label-icon" />
            ) : (
              <ToggleLeft size={13} className="onboarding-label-icon" />
            )}
            <span className="onboarding-label">Smooth animations</span>
          </div>
          <button
            className="onboarding-toggle"
            onClick={() => setAnimations(!animations)}
            aria-pressed={animations}
          >
            <span className={`onboarding-toggle-track ${animations ? 'on' : 'off'}`}>
              <span className="onboarding-toggle-knob" />
            </span>
          </button>
        </div>

        <button
          className="onboarding-cta"
          disabled={!canContinue}
          onClick={complete}
        >
          Get started
          <ArrowRight size={16} />
        </button>

        <button className="onboarding-skip" onClick={complete}>
          Skip for now
        </button>
      </div>
    )}
    </div>
  );
}
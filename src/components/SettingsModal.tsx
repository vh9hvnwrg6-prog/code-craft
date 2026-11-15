import React, { useState, useEffect } from 'react';
import {
  X,
  Palette,
  Cpu,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Settings,
} from 'lucide-react';
import { AISettings } from './AISettings';
import {
  THEMES,
  DEFAULT_PREFS,
  loadPrefs,
  savePrefs,
  type ThemePrefs,
} from '../theme';

type Tab = 'appearance' | 'ai';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('appearance');
  const [prefs, setPrefs] = useState<ThemePrefs>(DEFAULT_PREFS);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const save = () => {
    savePrefs(prefs);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const update = (patch: Partial<ThemePrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-tabs">
          <button
            className={`settings-tab ${tab === 'appearance' ? 'active' : ''}`}
            onClick={() => setTab('appearance')}
          >
            <Palette size={14} />
            <span>Appearance</span>
          </button>
          <button
            className={`settings-tab ${tab === 'ai' ? 'active' : ''}`}
            onClick={() => setTab('ai')}
          >
            <Cpu size={14} />
            <span>AI</span>
          </button>
        </div>

        <div className="settings-body">
          {tab === 'appearance' ? (
            <div className="appearance-tab">
              <h3 className="settings-section-title">Theme</h3>
              <div className="theme-grid">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    className={`theme-card ${prefs.theme === t.id ? 'active' : ''}`}
                    onClick={() => update({ theme: t.id })}
                  >
                    <div className="theme-swatch">
                      <span
                        className="theme-dot"
                        style={{ background: t.swatch[1] }}
                      />
                      <span
                        className="theme-dot"
                        style={{ background: t.swatch[2] }}
                      />
                      <span
                        className="theme-dot"
                        style={{ background: t.swatch[0] }}
                      />
                    </div>
                    <span className="theme-name">{t.name}</span>
                  </button>
                ))}
              </div>

              <h3 className="settings-section-title">Accent color</h3>
              <div className="accent-row">
                {['#8b5cf6', '#3b82f6', '#10b981', '#f97316', '#ec4899', '#f43f5e'].map((c) => (
                  <button
                    key={c}
                    className={`accent-swatch ${prefs.accent === c ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => update({ accent: c })}
                  />
                ))}
                <input
                  type="color"
                  value={prefs.accent}
                  onChange={(e) => update({ accent: e.target.value })}
                  className="accent-picker"
                  title="Custom color"
                />
              </div>

              <h3 className="settings-section-title">Font size</h3>
              <div className="font-size-row">
                {['12', '13', '14', '15', '16'].map((s) => (
                  <button
                    key={s}
                    className={`font-size-btn ${prefs.fontSize === s ? 'active' : ''}`}
                    onClick={() => update({ fontSize: s })}
                  >
                    {s}px
                  </button>
                ))}
              </div>

              <button className="btn-primary save-btn" onClick={save}>
                <Save size={14} />
                <span>Save Preferences</span>
              </button>
              {showSaved && (
                <span className="save-confirm">
                  <CheckCircle2 size={13} /> Preferences saved
                </span>
              )}
            </div>
          ) : (
            <AISettings onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}
// Shared theme definitions + application logic.
// Themes are applied as CSS custom properties on <html>, so every panel,
// border and gradient that references them updates instantly.

export type ThemeId = 'midnight' | 'aurora' | 'sunset' | 'mono';

export interface ThemePrefs {
  theme: ThemeId;
  accent: string;
  fontSize: string;
}

export interface ThemeDef {
  id: ThemeId;
  name: string;
  /** preview swatches */
  swatch: [string, string, string];
  vars: Record<string, string>;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    swatch: ['#0b0c14', '#7c3aed', '#3b82f6'],
    vars: {
      '--bg-base': '#0b0c14',
      '--bg-glow-1': 'rgba(79, 70, 229, 0.25)',
      '--bg-glow-2': 'rgba(124, 58, 237, 0.22)',
      '--bg-glow-3': 'rgba(8, 145, 178, 0.18)',
      '--bg-glow-4': 'rgba(168, 85, 247, 0.16)',
      '--panel-bg': 'rgba(20, 18, 28, 0.55)',
      '--panel-border': 'rgba(255, 255, 255, 0.08)',
      '--text-primary': '#f5f5f7',
      '--text-secondary': '#c0c0d0',
      '--text-muted': '#8b8ba0',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    swatch: ['#06140f', '#10b981', '#06b6d4'],
    vars: {
      '--bg-base': '#04100c',
      '--bg-glow-1': 'rgba(16, 185, 129, 0.22)',
      '--bg-glow-2': 'rgba(6, 182, 212, 0.20)',
      '--bg-glow-3': 'rgba(52, 211, 153, 0.16)',
      '--bg-glow-4': 'rgba(14, 116, 144, 0.18)',
      '--panel-bg': 'rgba(12, 32, 26, 0.55)',
      '--panel-border': 'rgba(255, 255, 255, 0.09)',
      '--text-primary': '#f0fdf9',
      '--text-secondary': '#b8d8cd',
      '--text-muted': '#7b9c92',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    swatch: ['#1a0a12', '#f97316', '#ec4899'],
    vars: {
      '--bg-base': '#150810',
      '--bg-glow-1': 'rgba(249, 115, 22, 0.20)',
      '--bg-glow-2': 'rgba(236, 72, 153, 0.22)',
      '--bg-glow-3': 'rgba(251, 146, 60, 0.16)',
      '--bg-glow-4': 'rgba(190, 24, 93, 0.18)',
      '--panel-bg': 'rgba(32, 16, 26, 0.55)',
      '--panel-border': 'rgba(255, 255, 255, 0.09)',
      '--text-primary': '#fff5f8',
      '--text-secondary': '#e0c2cd',
      '--text-muted': '#a0808c',
    },
  },
  {
    id: 'mono',
    name: 'Mono',
    swatch: ['#0e0e12', '#6b7280', '#9ca3af'],
    vars: {
      '--bg-base': '#0a0a0d',
      '--bg-glow-1': 'rgba(107, 114, 128, 0.18)',
      '--bg-glow-2': 'rgba(156, 163, 175, 0.14)',
      '--bg-glow-3': 'rgba(75, 85, 99, 0.16)',
      '--bg-glow-4': 'rgba(55, 65, 81, 0.18)',
      '--panel-bg': 'rgba(22, 22, 27, 0.6)',
      '--panel-border': 'rgba(255, 255, 255, 0.1)',
      '--text-primary': '#f3f4f6',
      '--text-secondary': '#c5c8ce',
      '--text-muted': '#8a8f98',
    },
  },
];

export const DEFAULT_PREFS: ThemePrefs = {
  theme: 'midnight',
  accent: '#8b5cf6',
  fontSize: '14',
};

export function loadPrefs(): ThemePrefs {
  try {
    const raw = localStorage.getItem('codecraft-prefs');
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw);
    return {
      theme: (p.theme as ThemeId) || DEFAULT_PREFS.theme,
      accent: p.accent || DEFAULT_PREFS.accent,
      fontSize: p.fontSize || DEFAULT_PREFS.fontSize,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Apply a theme + accent + font size to the document root. */
export function applyPrefs(prefs: ThemePrefs): void {
  const root = document.documentElement;
  const def = THEMES.find((t) => t.id === prefs.theme) || THEMES[0];
  for (const [k, v] of Object.entries(def.vars)) root.style.setProperty(k, v);
  root.style.setProperty('--accent', prefs.accent);
  root.style.setProperty('--font-size', `${prefs.fontSize}px`);
  root.setAttribute('data-theme', def.id);
}

export function savePrefs(prefs: ThemePrefs): void {
  try {
    localStorage.setItem('codecraft-prefs', JSON.stringify(prefs));
  } catch {}
  applyPrefs(prefs);
}

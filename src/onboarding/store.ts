import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export type ThemeId = 'midnight' | 'aurora' | 'sunset' | 'mono';
export type ResponseStyle = 'concise' | 'balanced' | 'detailed';

export interface OnboardingConfig {
  completed: boolean;
  version: number;
  userName: string;
  theme: ThemeId;
  animationsEnabled: boolean;
  responseStyle: ResponseStyle;
  createdAt: number;
}

const CURRENT_VERSION = 1;
const FILE = path.join(app.getPath('userData'), 'onboarding.json');

function defaults(): OnboardingConfig {
  return {
    completed: false,
    version: CURRENT_VERSION,
    userName: '',
    theme: 'midnight',
    animationsEnabled: true,
    responseStyle: 'balanced',
    createdAt: Date.now()
  };
}

export class OnboardingStore {
  private config: OnboardingConfig;

  constructor() {
    this.config = this.load();
  }

  private load(): OnboardingConfig {
    try {
      if (!fs.existsSync(FILE)) return defaults();
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Partial<OnboardingConfig>;
      return { ...defaults(), ...raw, version: CURRENT_VERSION };
    } catch {
      return defaults();
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(this.config, null, 2), {
        encoding: 'utf8',
        mode: 0o600
      });
    } catch (err) {
      console.error('[onboarding] failed to save', err);
    }
  }

  get(): OnboardingConfig {
    return { ...this.config };
  }

  isCompleted(): boolean {
    return this.config.completed;
  }

  setUserName(name: string): void {
    this.config.userName = name.trim();
    this.save();
  }

  setPreferences(prefs: Partial<Pick<OnboardingConfig, 'theme' | 'animationsEnabled' | 'responseStyle'>>): void {
    this.config = { ...this.config, ...prefs };
    this.save();
  }

  complete(): void {
    this.config.completed = true;
    this.save();
  }

  reset(): void {
    this.config = defaults();
    this.save();
  }
}
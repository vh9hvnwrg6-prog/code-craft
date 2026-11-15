import { app } from 'electron';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Claude Code memory store
//
// Persists long-term knowledge, user preferences, project context, and
// conversation summaries so Claude Code "remembers" across sessions.
// Stored as plain JSON (no secrets) in the user data directory.
// ---------------------------------------------------------------------------

export interface MemoryEntry {
  id: string;
  type: 'fact' | 'preference' | 'project' | 'summary' | 'instruction';
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  source: 'user' | 'agent' | 'auto';
}

export interface MemoryStore {
  add(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): MemoryEntry;
  list(filter?: { type?: MemoryEntry['type']; tag?: string }): MemoryEntry[];
  update(id: string, patch: Partial<Omit<MemoryEntry, 'id' | 'createdAt'>>): MemoryEntry | null;
  remove(id: string): boolean;
  search(query: string): MemoryEntry[];
  clear(): void;
}

const MEMORY_FILE = path.join(app.getPath('userData'), 'claude-memory.json');
const MAX_ENTRIES = 500;

function load(): MemoryEntry[] {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function save(entries: MemoryEntry[]): void {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(entries, null, 2), { encoding: 'utf8', mode: 0o600 });
  } catch (err) {
    console.error('[MemoryStore] Failed to save:', err);
  }
}

export function createMemoryStore(): MemoryStore {
  let entries: MemoryEntry[] = load();

  const persist = () => save(entries);

  const add: MemoryStore['add'] = (entry) => {
    const now = Date.now();
    const item: MemoryEntry = {
      ...entry,
      id: `mem-${now}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    entries.push(item);
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
    persist();
    return item;
  };

  const list: MemoryStore['list'] = (filter) => {
    let result = entries;
    if (filter?.type) result = result.filter((e) => e.type === filter.type);
    if (filter?.tag) result = result.filter((e) => e.tags.includes(filter.tag!));
    return result;
  };

  const update: MemoryStore['update'] = (id, patch) => {
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    entries[idx] = { ...entries[idx], ...patch, updatedAt: Date.now() };
    persist();
    return entries[idx];
  };

  const remove: MemoryStore['remove'] = (id) => {
    const before = entries.length;
    entries = entries.filter((e) => e.id !== id);
    if (entries.length !== before) persist();
    return entries.length !== before;
  };

  const search: MemoryStore['search'] = (query) => {
    const q = query.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.content.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)) ||
        e.type.toLowerCase().includes(q)
    );
  };

  const clear: MemoryStore['clear'] = () => {
    entries = [];
    persist();
  };

  return { add, list, update, remove, search, clear };
}
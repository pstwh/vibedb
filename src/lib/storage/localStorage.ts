const NAMESPACE = 'vibedb';

const buildKey = (...parts: string[]) => [NAMESPACE, ...parts].join(':');

export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
  key: buildKey,
};

const GEMINI_KEY = buildKey('ai', 'geminiApiKey');

export const getGeminiApiKey = (): string | null => storage.get<string>(GEMINI_KEY);
export const setGeminiApiKey = (key: string): void => storage.set<string>(GEMINI_KEY, key);
export const clearGeminiApiKey = (): void => storage.remove(GEMINI_KEY);



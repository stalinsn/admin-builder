/**
 * SSR-safe, error-tolerant localStorage helpers with JSON support and versioned keys.
 */

const isClient = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export function withVersion(key: string, version = 'v1'): string {
  return `${key}.${version}`;
}

export function safeGet(key: string): string | null {
  if (!isClient()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    console.warn(`[safeStorage] get failed for key "${key}":`, e);
    return null;
  }
}

export function safeSet(key: string, value: string): boolean {
  if (!isClient()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`[safeStorage] set failed for key "${key}":`, e);
    return false;
  }
}

export function safeRemove(key: string): boolean {
  if (!isClient()) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn(`[safeStorage] remove failed for key "${key}":`, e);
    return false;
  }
}

export function safeJsonGet<T>(key: string, fallback: T): T {
  const raw = safeGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`[safeStorage] json parse failed for key "${key}":`, e);
    return fallback;
  }
}

export function safeJsonSet<T>(key: string, value: T): boolean {
  try {
    return safeSet(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[safeStorage] json stringify failed for key "${key}":`, e);
    return false;
  }
}

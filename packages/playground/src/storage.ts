/** Best-effort playground source persistence. */

const KEY = "nota-playground:source";

export function loadSource(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveSource(source: string): void {
  try {
    localStorage.setItem(KEY, source);
  } catch {
    // Storage is optional.
  }
}

/**
 * Persist the editor source in `localStorage` so edits survive a page refresh. Both helpers are
 * defensive: a missing/blocked `localStorage` (private mode, quota, or a non-browser test env) is
 * swallowed so the playground still works, just without persistence.
 */

const KEY = "nota-playground:source";

/** The saved source, or `null` if nothing is stored (or storage is unavailable). */
export function loadSource(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Save the current source; no-op if storage is unavailable. */
export function saveSource(source: string): void {
  try {
    localStorage.setItem(KEY, source);
  } catch {
    // ignore (private mode / quota exceeded / no localStorage)
  }
}

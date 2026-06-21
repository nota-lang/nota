/**
 * localStorage persistence for the editor source: round-trip, empty-on-first-load, and graceful
 * degradation when `localStorage` throws (private mode / quota / no storage).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSource, saveSource } from "../src/storage";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("source persistence", () => {
  it("returns null before anything is saved", () => {
    expect(loadSource()).toBeNull();
  });

  it("round-trips the saved source", () => {
    saveSource("@p{hello}");
    expect(loadSource()).toBe("@p{hello}");
  });

  it("does not throw when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveSource("x")).not.toThrow();
    expect(loadSource()).toBeNull();
  });
});

/**
 * `resolve.dedupe` is how the preset keeps identity-sensitive packages to one copy per bundle.
 * Two rules it has to get right, in tension with each other:
 *
 * - the framework packages are deduped unconditionally (two copies of the doc-state context or
 *   Solid's runtime split the page's reactive state), and
 * - the host-owned singletons (CodeMirror, Lezer) are deduped *only when installed*, because
 *   Vite resolves a deduped id from the project root and reports an unresolved import rather
 *   than falling back — so listing a package a site does not have breaks that site's build.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ConfigEnv, UserConfig } from "vite";
import { describe, expect, test, vi } from "vitest";
import {
  DEDUPED_PACKAGES,
  dedupedPackages,
  duplicateSingletons,
  notaTransform
} from "../src/lib";

/** A project root with `packages` installed into its own `node_modules`. */
function projectRoot(packages: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), "nota-dedupe-"));
  for (const pkg of packages) {
    const dir = join(root, "node_modules", pkg);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: pkg }));
  }
  return root;
}

function configuredDedupe(root: string): string[] {
  const hook = notaTransform().config;
  const fn = typeof hook === "function" ? hook : hook?.handler;
  if (!fn) throw new Error("plugin has no config hook");
  const env = { command: "build", mode: "production" } as ConfigEnv;
  const out = fn.call({} as never, { root } as UserConfig, env) as UserConfig;
  return out.resolve?.dedupe as string[];
}

describe("dedupedPackages", () => {
  test("always dedupes the framework packages", () => {
    const deduped = dedupedPackages(projectRoot());
    for (const pkg of DEDUPED_PACKAGES) {
      expect(deduped).toContain(pkg);
    }
  });

  test("omits singletons the project has not installed", () => {
    // A Nota site with no editors in it: naming CodeMirror here would break its build.
    expect(dedupedPackages(projectRoot())).toEqual([...DEDUPED_PACKAGES]);
  });

  test("dedupes the editor stack once it is installed", () => {
    const root = projectRoot([
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/language",
      "@lezer/highlight",
      "style-mod"
    ]);
    expect(dedupedPackages(root)).toEqual([
      ...DEDUPED_PACKAGES,
      "@codemirror/language",
      "@codemirror/state",
      "@codemirror/view",
      "@lezer/highlight",
      "style-mod"
    ]);
  });

  test("takes each singleton on its own, not the set", () => {
    const deduped = dedupedPackages(projectRoot(["@codemirror/state"]));
    expect(deduped).toContain("@codemirror/state");
    expect(deduped).not.toContain("@codemirror/view");
  });

  test("picks up scope members it has never heard of", () => {
    // The list is read off the install: a grammar package added by the site needs no release.
    expect(dedupedPackages(projectRoot(["@lezer/svelte"]))).toContain(
      "@lezer/svelte"
    );
  });

  test("finds packages installed above the root, as node would", () => {
    const parent = projectRoot(["@codemirror/state"]);
    const root = join(parent, "site");
    mkdirSync(root);
    expect(dedupedPackages(root)).toContain("@codemirror/state");
  });
});

describe("duplicateSingletons", () => {
  // pnpm's real shape: the package directory under the store entry that owns it.
  const copy = (store: string, pkg: string, file = "dist/index.js") =>
    `/${store}/node_modules/.pnpm/${pkg.replace("/", "+")}@6.7.1/node_modules/${pkg}/${file}`;

  test("says nothing about a graph with one copy of each", () => {
    const ids = [
      copy("app", "@codemirror/state"),
      copy("app", "@codemirror/view"),
      "/app/src/editor.ts"
    ];
    expect(duplicateSingletons(ids).size).toBe(0);
  });

  test("reports the package directories a duplicate came from", () => {
    const ids = [
      copy("app", "@codemirror/state"),
      copy("linked", "@codemirror/state", "dist/index.js")
    ];
    const dupes = duplicateSingletons(ids);
    expect([...dupes.keys()]).toEqual(["@codemirror/state"]);
    expect(dupes.get("@codemirror/state")).toEqual([
      "/app/node_modules/.pnpm/@codemirror+state@6.7.1/node_modules/@codemirror/state/",
      "/linked/node_modules/.pnpm/@codemirror+state@6.7.1/node_modules/@codemirror/state/"
    ]);
  });

  test("counts a package, not its modules", () => {
    const ids = ["dist/index.js", "dist/chunk.js", "package.json"].map(f =>
      copy("app", "@lezer/highlight", f)
    );
    expect(duplicateSingletons(ids).size).toBe(0);
  });

  test("ignores packages outside the singleton scopes", () => {
    const ids = [copy("app", "prettier"), copy("linked", "prettier")];
    expect(duplicateSingletons(ids).size).toBe(0);
  });

  test("holds the whole @codemirror and @lezer scopes to the rule", () => {
    // The grammar packages carry a `Language`/parser instance, looked up by reference.
    const ids = [
      copy("app", "@codemirror/lang-javascript"),
      copy("linked", "@codemirror/lang-javascript"),
      copy("app", "@lezer/javascript"),
      copy("linked", "@lezer/javascript")
    ];
    expect([...duplicateSingletons(ids).keys()]).toEqual([
      "@codemirror/lang-javascript",
      "@lezer/javascript"
    ]);
  });

  test("the plugin warns once per duplicated package", () => {
    const plugin = notaTransform();
    const hook = plugin.buildEnd;
    const fn = typeof hook === "function" ? hook : hook?.handler;
    if (!fn) throw new Error("plugin has no buildEnd hook");
    const warn = vi.fn();
    const ids = [
      copy("app", "@codemirror/lint"),
      copy("linked", "@codemirror/lint"),
      copy("app", "@codemirror/autocomplete"),
      copy("linked", "@codemirror/autocomplete")
    ];
    fn.call({ getModuleIds: () => ids.values(), warn } as never);
    expect(warn).toHaveBeenCalledTimes(2);
    // The message has to carry the remedy: dedupe only reaches root-resolvable packages.
    expect(warn.mock.calls.map(([m]) => m).join("\n")).toContain(
      "dependencies to give resolve.dedupe"
    );
  });
});

describe("the config hook", () => {
  test("reports the project's list, not the static one", () => {
    const root = projectRoot(["@codemirror/state"]);
    expect(configuredDedupe(root)).toEqual([
      ...DEDUPED_PACKAGES,
      "@codemirror/state"
    ]);
  });

  test("falls back to the cwd when the config names no root", () => {
    const hook = notaTransform().config;
    const fn = typeof hook === "function" ? hook : hook?.handler;
    const env = { command: "serve", mode: "development" } as ConfigEnv;
    const out = fn?.call({} as never, {} as UserConfig, env) as UserConfig;
    expect(out.resolve?.dedupe).toEqual(dedupedPackages(process.cwd()));
  });
});

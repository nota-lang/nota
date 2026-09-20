/**
 * Pack and install into a scratch project outside the workspace. Exercise published exports,
 * JSX compilation, and stale-artifact resolution through the shipped CLI.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const packagesDir = join(here, "..", "..");

/** The manifest fields this suite reads. */
interface PackageJson {
  name: string;
  private?: boolean;
  exports?: Record<string, unknown>;
}

interface Packed {
  name: string;
  dir: string;
  tarball: string;
  json: PackageJson;
}

let scratch: string;
let packed: Packed[];

/** The CLI's own manifest: the source of truth for what the consumer fixture has to declare. */
const cliManifest = JSON.parse(
  readFileSync(join(here, "..", "package.json"), "utf8")
) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

/**
 * What a consumer must install *besides* the Nota packages, read off the CLI's manifest so the
 * fixture cannot drift from the workspace.
 *
 * - **`solid-js` + `@solidjs/web`.** Solid 2 is two packages, and both are peers of
 *   `@nota-lang/core` and `@nota-lang/prelude` (`solid-js/web` no longer exists; the emit imports
 *   the scoped one). Pinned rather than left to pnpm's auto-install-peers, because a peer range
 *   resolved against the live registry is exactly the drift this suite must not have.
 * - **`@shikijs/langs`.** A tagged fence (```` ```rust ````) compiles to
 *   `import … from "@shikijs/langs/rust"`, which the CLI's pinned resolver looks up from the CLI
 *   package — and the CLI declares the grammars as a *dev* dependency, so a consumer install has
 *   none. Node's walk from the anchor reaches the consumer root's `node_modules`, so a consumer
 *   that declares it works; one that does not gets "failed to resolve @shikijs/langs/<tag>". That
 *   is the shipped contract, and this fixture is a consumer that holds up its end.
 */
const CONSUMER_DEPS: Record<string, string> = {
  "solid-js": cliManifest.dependencies["solid-js"],
  "@solidjs/web": cliManifest.dependencies["@solidjs/web"],
  "@shikijs/langs": cliManifest.devDependencies["@shikijs/langs"]
};

/** Every workspace package that `pnpm -r publish` would push. */
function publishablePackages(): {
  name: string;
  dir: string;
  json: PackageJson;
}[] {
  return readdirSync(packagesDir)
    .map(name => join(packagesDir, name))
    .filter(dir => existsSync(join(dir, "package.json")))
    .map(dir => ({
      dir,
      json: JSON.parse(
        readFileSync(join(dir, "package.json"), "utf8")
      ) as PackageJson
    }))
    .filter(p => p.json.private !== true)
    .map(p => ({ name: p.json.name, dir: p.dir, json: p.json }));
}

const run = (cmd: string, args: string[], cwd: string) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: "pipe" });

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "nota-packaging-"));
  const tarDir = join(scratch, "tarballs");

  // `pnpm pack` is what publish would upload, and it rewrites `workspace:*` to real versions —
  // which is exactly why the overrides below are needed to point them back at these tarballs
  // rather than at whatever the registry happens to hold.
  packed = publishablePackages().map(p => {
    const out = run("pnpm", ["pack", "--pack-destination", tarDir], p.dir);
    const tarball = out.trim().split("\n").pop() as string;
    return { name: p.name, dir: p.dir, tarball, json: p.json };
  });

  const overrides = Object.fromEntries(
    packed.map(p => [p.name, `file:${p.tarball}`])
  );
  writeFileSync(
    join(scratch, "package.json"),
    JSON.stringify(
      {
        name: "nota-packaging-smoke",
        private: true,
        version: "0.0.0",
        type: "module",
        // Every package is a direct dependency, not just the CLI: pnpm's isolated layout only
        // exposes direct dependencies at the root, and the resolution test below has to ask the
        // questions a consumer of each package would ask.
        //
        // See CONSUMER_DEPS: the peers a consumer of these packages has to bring itself.
        dependencies: { ...overrides, ...CONSUMER_DEPS }
      },
      null,
      2
    )
  );
  // The overrides have to be repeated for the *transitive* `@nota-lang/*` edges. `pnpm pack`
  // rewrote every `workspace:*` to a plain version, so without them prelude's dependency on
  // `@nota-lang/core` resolves from the REGISTRY — the published copy quietly shadowing the
  // tarball under test, which is the one outcome this suite must never have.
  //
  // They live in `pnpm-workspace.yaml`, not in package.json's `pnpm` field: pnpm 11 stopped
  // reading that field (it warns and ignores it). Writing the file also makes this directory its
  // own workspace root, which is what `--ignore-workspace` used to buy — pnpm stops here and
  // never walks up to the monorepo and its `link:` overrides. The flag itself must go: under it
  // pnpm ignores the workspace file, overrides and all.
  writeFileSync(
    join(scratch, "pnpm-workspace.yaml"),
    `packages: []\noverrides:\n${Object.entries(overrides)
      .map(
        ([name, spec]) => `  ${JSON.stringify(name)}: ${JSON.stringify(spec)}`
      )
      .join("\n")}\n`
  );
  run("pnpm", ["install", "--no-frozen-lockfile", "--silent"], scratch);
}, 900_000);

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

describe("the packed tarballs", () => {
  test("a package that ships JSX declares the solid condition", () => {
    // `@solidjs/vite-plugin`'s `containsSolidField` walks `exports` for a `solid` key and adds
    // the package to `ssr.noExternal` on the strength of it. A JSX-shipping package without one
    // is handed to Node raw. The 3.x rewrite kept the function and the walk verbatim (verified
    // in `@solidjs/vite-plugin@3.0.0-next.43`'s `dist/esm/index.mjs`), so this check is
    // unchanged by the rename.
    for (const p of packed) {
      const files = tarballFiles(p.tarball);
      const shipsJsx = files.some(f => f.endsWith(".jsx"));
      if (!shipsJsx) continue;
      expect(
        JSON.stringify(p.json.exports ?? {}).includes('"solid"'),
        `${p.name} ships JSX but declares no "solid" export condition`
      ).toBe(true);
    }
  });

  test("no tarball carries a .js shadowing a .jsx of the same module", () => {
    // dist/ is not cleaned between builds. An extensionless relative import resolves `.js`
    // before `.jsx`, so a leftover copy silently wins over the real one.
    for (const p of packed) {
      const stems = tarballFiles(p.tarball)
        .filter(f => /\.(js|jsx)$/.test(f))
        .map(f => f.replace(/\.(js|jsx)$/, ""));
      const shadowed = stems.filter((s, i) => stems.indexOf(s) !== i);
      expect(
        [...new Set(shadowed)],
        `${p.name} has stale dist artifacts`
      ).toEqual([]);
    }
  });

  test("every exports subpath resolves as a consumer would resolve it", () => {
    // The map is a promise about files that exist in the tarball; tsc's output extension and the
    // map are edited in different files and drift apart silently.
    for (const p of packed) {
      const subpaths = Object.keys(p.json.exports ?? {}).filter(
        k => !k.includes("*")
      );
      for (const sub of subpaths) {
        const specifier = sub === "." ? p.name : `${p.name}/${sub.slice(2)}`;
        const resolved = run(
          process.execPath,
          [
            "--conditions=solid",
            "-e",
            `process.stdout.write(import.meta.resolve(${JSON.stringify(specifier)}))`
          ],
          scratch
        );
        expect(
          existsSync(new URL(resolved).pathname),
          `${specifier} resolves to a file that is not in the package`
        ).toBe(true);
      }
    }
  });
});

describe("the installed CLI builds a real document", () => {
  test("a document using tex, code, definitions and figures renders", () => {
    // One document over four prelude submodules: each is a separate `exports` entry, a separate
    // import in the emit, and for def/figure a separate stylesheet.
    const doc = join(scratch, "doc.nota");
    writeFileSync(
      doc,
      [
        "# Smoke",
        "",
        'Inline math $x^2$ and a @Def[id: "widget"]{widget}.',
        "",
        "```rust",
        "fn main() {}",
        "```",
        "",
        "@Figure{@Caption{A caption.}}",
        ""
      ].join("\n")
    );
    const out = join(scratch, "out");
    run(
      process.execPath,
      [
        join(scratch, "node_modules/@nota-lang/cli/bin/nota.mjs"),
        "build",
        doc,
        "-o",
        out
      ],
      scratch
    );

    const html = readFileSync(join(out, "index.html"), "utf8");
    expect(html, "the heading rendered").toContain("Smoke");
    // Tex → prelude/tex → katex, in MathML (the default output mode).
    expect(html, "math rendered").toContain("<math");
    // CodeBlock → prelude/code, with the grammar the fence tag auto-registered.
    expect(html, "the fence highlighted").toContain('class="shiki');
    // Def → prelude/def.
    expect(html, "the definition rendered").toContain("nota-def");
    // Figure → prelude/figure.
    expect(html, "the figure rendered").toContain("nota-figure");

    // …and the stylesheets those two submodules import reached the page, which only happens if
    // the bundler resolved `@nota-lang/prelude/*.css` through the exports map.
    const css = readdirSync(join(out, "assets"))
      .filter(f => f.endsWith(".css"))
      .map(f => readFileSync(join(out, "assets", f), "utf8"))
      .join("\n");
    expect(css, "figure.css shipped").toContain("nota-figure");
    expect(css, "def.css shipped").toContain("nota-def-tooltip-open");
  }, 300_000);
});

/** The file list inside a tarball, package/ prefix stripped. */
function tarballFiles(tarball: string): string[] {
  return execFileSync("tar", ["tzf", tarball], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .map(f => f.replace(/^package\//, ""));
}

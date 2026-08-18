/**
 * Transform-hook unit tests (the hook invoked directly — no Vite build): extension claiming,
 * the asset-query carve-out, and the compiled JSX surface.
 */
import { describe, expect, test } from "vitest";
import { nota, notaTransform } from "../src/lib";

type TransformFn = (
  code: string,
  id: string
) => { code: string; map?: unknown } | null;

function getTransform(opts?: Parameters<typeof notaTransform>[0]): TransformFn {
  const hook = notaTransform(opts).transform;
  const fn = typeof hook === "function" ? hook : hook?.handler;
  if (!fn) throw new Error("plugin has no transform hook");
  return fn as unknown as TransformFn;
}

const DOC = "# Hi\n\nSome *bold* prose.\n\n- a\n- b\n";

describe("claiming", () => {
  test("claims .nota (with ?query/#hash), passes everything else through", () => {
    const t = getTransform();
    expect(t(DOC, "/x/doc.nota")).not.toBeNull();
    expect(t(DOC, "/x/doc.nota?t=123")).not.toBeNull();
    expect(t(DOC, "/x/doc.nota#frag")).not.toBeNull();
    expect(t("code", "/x/app.tsx")).toBeNull();
    expect(t("code", "/x/doc.notarize")).toBeNull();
  });

  test("?raw/?url/?inline are the asset pipeline's — never claimed", () => {
    const t = getTransform();
    expect(t(DOC, "/x/doc.nota?raw")).toBeNull();
    expect(t(DOC, "/x/doc.nota?url")).toBeNull();
    expect(t(DOC, "/x/doc.nota?inline")).toBeNull();
  });

  test("custom extensions replace the default", () => {
    const t = getTransform({ extensions: [".ntx"] });
    expect(t(DOC, "/x/doc.ntx")).not.toBeNull();
    expect(t(DOC, "/x/doc.nota")).toBeNull();
  });
});

describe("output surface", () => {
  test("emits a Solid JSX module with the structural + prelude imports", () => {
    const out = getTransform()(DOC, "/x/doc.nota");
    if (!out) throw new Error("not transformed");
    expect(out.code).toContain("export default function Doc()");
    expect(out.code).toContain("<NotaDoc>");
    expect(out.code).toContain("<UlLi>");
    expect(out.code).toMatch(
      /import \{ NotaDoc, UlLi \} from "@nota-lang\/core";/
    );
    expect(out.code).toMatch(
      /import \{ Heading \} from "@nota-lang\/prelude";/
    );
    expect(out.code).not.toMatch(/\bh\(/);
    // The host-renderer brand rides after the emit (Astro check() dispatch).
    expect(out.code).toContain("export default function Doc()");
    expect(out.code).toContain("Doc.isNotaDoc = true;");
  });

  test("preludeModule redirects the ambient import; false disables it", () => {
    const custom = getTransform({ preludeModule: "/site/prelude.ts" })(
      DOC,
      "/x/doc.nota"
    );
    expect(custom?.code).toContain('from "/site/prelude.ts"');
    const off = getTransform({ preludeModule: false })(DOC, "/x/doc.nota");
    expect(off?.code).not.toContain("@nota-lang/prelude");
  });

  test("a reader diagnostic throws with the source path", () => {
    expect(() => getTransform()("@p{unterminated", "/x/bad.nota")).toThrow(
      /failed to compile[\s\S]*bad\.nota/
    );
  });
});

describe("the one-solid-js invariant", () => {
  test("config() pins resolve.dedupe on solid-js and the state-carrying @nota-lang packages", () => {
    // One solid-js per page is a correctness invariant: a second bundled copy leaves
    // enableHydration() uncalled in one of them, so hydration-context nesting is silently OFF
    // and claiming misses ("template is not a function" in Dynamic / "Hydration Mismatch").
    // The @nota-lang packages ride along because they carry per-instance module state (the
    // doc-state context, the config singletons). The transform plugin's config() hook is where
    // the pin lives — assert it survives.
    const hook = notaTransform().config;
    const fn = typeof hook === "function" ? hook : hook?.handler;
    if (!fn) throw new Error("plugin has no config hook");
    const conf = (
      fn as (
        c: unknown,
        env: unknown
      ) => { resolve?: { dedupe?: string[] } } | null
    ).call({}, {}, { command: "build", mode: "production" });
    const dedupe = conf?.resolve?.dedupe ?? [];
    for (const pkg of ["solid-js", "@nota-lang/core", "@nota-lang/prelude"]) {
      expect(dedupe).toContain(pkg);
    }
  });
});

describe("the preset shape", () => {
  test("nota() bundles vite-plugin-solid; { solid: false } omits it", () => {
    const full = nota();
    expect(full.length).toBeGreaterThan(1);
    expect(full[0].name).toBe("@nota-lang/vite");
    expect(full.some(p => /solid/.test(p.name ?? ""))).toBe(true);
    const bare = nota({ solid: false });
    expect(bare).toHaveLength(1);
  });
});

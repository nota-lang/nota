/**
 * `?bib` imports, at all three levels: the BibTeX → JSON parse on its own, which ids the
 * transform hook claims, and the whole path through a real Vite graph — `%import bib from
 * "./refs.bib?bib"` in a document, into `bibset`, out as a rendered bibliography.
 */
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { BibDatabase } from "../src/bib";
import { nota, notaTransform, parseBib } from "../src/lib";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));

type TransformFn = (
  code: string,
  id: string
) => { code: string; map?: unknown } | null;

function getTransform(): TransformFn {
  const hook = notaTransform().transform;
  const fn = typeof hook === "function" ? hook : hook?.handler;
  if (!fn) throw new Error("plugin has no transform hook");
  return fn as unknown as TransformFn;
}

const BIB = `@book{knuth84, title = {The {TeX}book}, year = 1984}`;

describe("parseBib", () => {
  test("keys by cite key, and folds the case BibTeX folds", () => {
    const db = parseBib(
      `@InProceedings{Knuth84a,
         Author = {Donald E. Knuth},
         TITLE  = {Literate Programming},
         year   = {1984}
       }`,
      "/x/refs.bib"
    );
    // Entry type and field names fold; the cite key does not — Nota's `@Cite{…}`/`&…` match
    // `bibset`'s keys exactly, so folding a key would break the citations that spell it.
    expect(db).toEqual({
      Knuth84a: {
        entryType: "inproceedings",
        author: "Donald E. Knuth",
        title: "Literate Programming",
        year: "1984"
      }
    });
  });

  test("takes braces off values, but leaves TeX escapes alone", () => {
    const db = parseBib(
      `@book{k,
         title  = {The {TeX}book},
         author = {{ACM SIGPLAN}},
         note   = {a \\{ literal \\} brace},
         series = {caf\\'{e} and {\\"o}}
       }`,
      "/x/refs.bib"
    );
    // Unescaped braces are BibTeX's grouping markers, so they come out...
    expect(db.k.title).toBe("The TeXbook");
    expect(db.k.author).toBe("ACM SIGPLAN");
    // ...but `\{` is the literal, and no TeX gets interpreted on the way through.
    expect(db.k.note).toBe("a \\{ literal \\} brace");
    expect(db.k.series).toBe("caf\\'e and \\\"o");
  });

  test("collapses the whitespace a wrapped value is written with", () => {
    const db = parseBib(
      `@book{k, author = {Donald E.
                          Knuth  and  Leslie
                          Lamport}, title = "The
         TeXbook" }`,
      "/x/refs.bib"
    );
    expect(db.k.author).toBe("Donald E. Knuth and Leslie Lamport");
    expect(db.k.title).toBe("The TeXbook");
  });

  test("reads the value forms BibTeX allows", () => {
    const db = parseBib(
      `% a comment line
       @book{k,
         title     = {A} # {B},
         year      = 1984,
         month     = jun,
         publisher = "quoted",
       }`,
      "/x/refs.bib"
    );
    expect(db.k).toEqual({
      entryType: "book",
      title: "AB", // `#` concatenation
      year: "1984", // a bare number
      month: "jun", // a bare month macro
      publisher: "quoted" // quotes, and a trailing comma after it
    });
  });

  test("@preamble and @comment are not entries", () => {
    const db = parseBib(
      `@preamble{"\\newcommand{\\noop}{}"}
       @comment{ignore me}
       @book{k, title = {T}}`,
      "/x/refs.bib"
    );
    expect(Object.keys(db)).toEqual(["k"]);
  });

  test("an empty file is an empty database", () => {
    expect(parseBib("", "/x/refs.bib")).toEqual({});
  });

  test("a cite key named __proto__ stays data", () => {
    const db = parseBib(`@book{__proto__, title = {T}}`, "/x/refs.bib");
    // Filing this with `db[key] = …` would reach the prototype setter instead of defining a
    // property, and the entry would vanish; the Map/`fromEntries` build is what avoids it.
    expect(Object.hasOwn(db, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(db)).toBe(Object.prototype);
    expect(db.__proto__.title).toBe("T");
    // A *field* by that name is a different matter: the parser accumulates fields by plain
    // assignment, so it is dropped upstream, before this module sees the entry at all.
    const dropped = parseBib(`@book{k, __proto__ = {x}}`, "/x/refs.bib");
    expect(Object.keys(dropped.k)).toEqual(["entryType"]);
  });
});

describe("parseBib rejects what would otherwise fail silently", () => {
  test("an entry the parser had to invent a key for", () => {
    // The parser fills a missing key in from the author and year, and an entry under a made-up
    // key is a citation that never resolves — reported nowhere near this file.
    expect(() =>
      parseBib(
        `@article{author = {Knuth, D}, year = {1984}, title = {x}}`,
        "/x/refs.bib"
      )
    ).toThrow(
      /\/x\/refs\.bib: a @article entry has no cite key.*"Knuth, 1984"/s
    );
  });

  test("the residual case the invented key is indistinguishable in", () => {
    // No author and no year leaves the invented key looking exactly like a hand-written one, so
    // this is a documented limitation rather than an error. Pinned so a change is deliberate.
    expect(parseBib(`@article{title = {x}}`, "/x/refs.bib")).toEqual({
      undefined: { entryType: "article", title: "x" }
    });
  });

  test("two entries claiming one cite key", () => {
    expect(() =>
      parseBib(`@book{k, title={A}}\n@book{k, title={B}}`, "/x/refs.bib")
    ).toThrow(/two entries share the cite key "k"/);
  });

  test("a syntax error, named against the file", () => {
    expect(() => parseBib(`@book{k, title = {T`, "/x/refs.bib")).toThrow(
      /failed to parse \/x\/refs\.bib as BibTeX: Unterminated value/
    );
  });

  test("an unbraced value the parser will not read", () => {
    // Thrown as a bare string rather than an error, and reported as parser internals plus the
    // rest of the input, so the message is this module's. All it can name is the offending
    // token — an `@string` macro name used as a value, here.
    expect(() => parseBib(`@book{k, publisher = acme}`, "/x/refs.bib")).toThrow(
      /\/x\/refs\.bib as BibTeX: "acme" is not a value the parser reads/
    );
    expect(() => parseBib(`@book{k, publisher = acme}`, "/x/refs.bib")).toThrow(
      /Braces always work: \{acme\}/
    );
  });

  test("a bare number the parser will not read, because a line break follows it", () => {
    // The parser reads a bare number only when a comma or a space comes next, so a last field
    // with no trailing comma fails — ordinary formatting, and a message ("Value expected:
    // single_value1984\n}") that names nothing a reader could act on.
    expect(() =>
      parseBib(`@book{k,\n  title = {T},\n  year = 1984\n}`, "/x/refs.bib")
    ).toThrow(/"1984" is not a value the parser reads/);
    // The same value braced, or followed by a comma, is fine.
    expect(parseBib(`@book{k,\n  year = {1984}\n}`, "/x/refs.bib").k.year).toBe(
      "1984"
    );
    expect(parseBib(`@book{k,\n  year = 1984,\n}`, "/x/refs.bib").k.year).toBe(
      "1984"
    );
  });

  test("@string, which the parser has no implementation for at all", () => {
    // It fails as a missing method, which says nothing about BibTeX or about the file.
    expect(() =>
      parseBib(`@string{acm = {ACM}}\n@book{k, publisher = acm}`, "/x/refs.bib")
    ).toThrow(
      /@string macros are not supported.*Substitute the macro's value/s
    );
  });
});

describe("which ids the transform claims", () => {
  test("?bib is the opt-in, and it is the query that decides", () => {
    const t = getTransform();
    const emitted = t(BIB, "/x/refs.bib?bib");
    expect(emitted?.code).toBe(
      `export default {"knuth84":{"entryType":"book","title":"The TeXbook","year":"1984"}};\n`
    );
    // The generated module has no line in common with the `.bib` source it came from.
    expect(emitted?.map).toEqual({ mappings: "" });
    // Position in the query, and a trailing fragment, do not matter.
    expect(t(BIB, "/x/refs.bib?bib&t=1")).not.toBeNull();
    expect(t(BIB, "/x/refs.bib?t=1&bib")).not.toBeNull();
    expect(t(BIB, "/x/refs.bib?bib#frag")).not.toBeNull();
  });

  test("without the query, or with the asset pipeline's, it is not ours", () => {
    const t = getTransform();
    expect(t(BIB, "/x/refs.bib")).toBeNull();
    expect(t(BIB, "/x/refs.bib?raw")).toBeNull();
    expect(t(BIB, "/x/refs.bib?url")).toBeNull();
    expect(t(BIB, "/x/refs.bib?inline")).toBeNull();
    expect(t(BIB, "/x/refs.bib?raw&bib")).toBeNull();
    // `bib` is a whole flag, not a prefix of one.
    expect(t(BIB, "/x/refs.bib?bibliography")).toBeNull();
  });

  test("the .nota path is untouched by any of it", () => {
    const t = getTransform();
    expect(t("# Hi\n", "/x/doc.nota")?.code).toContain(
      "export default function Doc()"
    );
    expect(t("# Hi\n", "/x/doc.nota?t=123")).not.toBeNull();
    expect(t("# Hi\n", "/x/doc.nota?raw")).toBeNull();
  });

  test("a parse error surfaces against the importing id", () => {
    expect(() =>
      getTransform()("@book{k, title = {T", "/x/refs.bib?bib")
    ).toThrow(/failed to parse \/x\/refs\.bib as BibTeX/);
  });
});

describe("?bib end to end", () => {
  let server: ViteDevServer;
  let html = "";
  let bib: BibDatabase;

  beforeAll(async () => {
    server = await createServer({
      configFile: false,
      root: pkgRoot,
      plugins: [nota()],
      server: { middlewareMode: true },
      appType: "custom",
      logLevel: "error"
    });
    const mod = (await server.ssrLoadModule(
      "/tests/fixtures/bib-entry.ts"
    )) as { run: () => { html: string; bib: BibDatabase } };
    const out = mod.run();
    // Same scrub as ./e2e.test.ts: hydration keys and Solid's SSR boundary comments.
    html = out.html
      .replace(/\s*data-hk="[^"]*"/g, "")
      .replace(/<!--\/?!?\$?-->/g, "");
    bib = out.bib;
  }, 60_000);

  afterAll(async () => {
    await server?.close();
  });

  test("the import resolves to the parsed database", () => {
    expect(bib.knuth84).toEqual({
      entryType: "book",
      author: "Donald E. Knuth",
      title: "The TeXbook",
      publisher: "Addison-Wesley",
      year: "1984",
      url: "https://ctan.org/pkg/texbook"
    });
    expect(bib.victor11.author).toBe("Bret Victor and Ada Lovelace");
    expect(bib.victor11.booktitle).toBe("Proceedings of the ACM Symposium");
    // `@preamble`/`@comment` in the fixture are not citable and did not become entries.
    expect(Object.keys(bib)).toEqual(["knuth84", "victor11"]);
  });

  test("the database drives bibset, so the citations number and link", () => {
    expect(html).toMatch(/<a[^>]*href="#bib-knuth84"[^>]*class="nota-cite"/);
    expect(html).toMatch(/<a[^>]*href="#bib-victor11"[^>]*class="nota-cite"/);
    // Numbered in order of first citation, and no `?` — every key resolved.
    expect(html).toContain("[1]");
    expect(html).toContain("[2]");
    expect(html).not.toContain("[?]");
  });

  test("the bibliography renders the parsed fields", () => {
    const list = /<ol class="nota-bibliography[^"]*">([\s\S]*?)<\/ol>/.exec(
      html
    );
    expect(list).toBeTruthy();
    const items = list?.[1] ?? "";
    expect(items).toContain('id="bib-knuth84"');
    // Brace-stripped and whitespace-collapsed, as the entry came out of the parse.
    expect(items).toContain("Donald E. Knuth. The TeXbook. 1984.");
    expect(items).toContain('href="https://ctan.org/pkg/texbook"');
    expect(items).toContain(
      "Bret Victor and Ada Lovelace. Explorable Explanations. 2011."
    );
  });

  test("a client-side import of the same module transforms too", async () => {
    // The SSR path above and the browser path are separate environments in Vite; the browser
    // one puts the id through `?import`, so it is worth transforming once each way.
    const result = await server.transformRequest(
      "/tests/fixtures/refs.bib?bib"
    );
    expect(result?.code).toContain('"knuth84"');
    expect(result?.code).toContain("export default");
  });
});

/**
 * **`@nota-lang/cli` entrypoint** — `nota build doc.nota → doc.html`.
 *
 * The simplest Nota integrator: one `.nota` file → one **self-contained** HTML file, every asset
 * inlined. Its page policy is trivial — the input file is the page. All the work is in
 * {@link "./build".buildNotaFile}; this is the thin argv/IO shell.
 *
 * Usage:
 * ```
 * nota build <doc.nota> [-o <out.html>] [--title <t>]
 * ```
 * With no `-o`, the output path is the input with its extension swapped to `.html`
 * (`doc.nota → doc.html`).
 */

import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import { buildNotaFile } from "./build";

const USAGE = `nota — build a .nota document into one self-contained .html file

Usage:
  nota build <doc.nota> [options]

Options:
  -o, --out <file>     output path (default: input with .html extension)
  --title <title>      document <title> (default: the input basename)
  -h, --help           show this help
`;

interface Args {
  command?: string;
  input?: string;
  out?: string;
  title?: string;
  help: boolean;
}

/** Minimal argv parser (no dependency): `nota build in.nota -o out.html --title T`. */
function parseArgs(argv: string[]): Args {
  const args: Args = { help: false };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      args.help = true;
    } else if (a === "-o" || a === "--out") {
      args.out = argv[++i];
    } else if (a === "--title") {
      args.title = argv[++i];
    } else {
      rest.push(a);
    }
  }
  args.command = rest[0];
  args.input = rest[1];
  return args;
}

/** Swap a path's extension to `.html` (`a/b/doc.nota` → `a/b/doc.html`). */
function toHtmlPath(input: string): string {
  return `${input.replace(/\.[^./\\]+$/, "")}.html`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.command === undefined) {
    process.stdout.write(USAGE);
    process.exit(args.help ? 0 : 1);
  }

  if (args.command !== "build") {
    process.stderr.write(`nota: unknown command "${args.command}"\n\n${USAGE}`);
    process.exit(1);
  }

  if (args.input === undefined) {
    process.stderr.write(`nota: missing input file\n\n${USAGE}`);
    process.exit(1);
  }

  const outPath = args.out ?? toHtmlPath(args.input);

  try {
    const { html, hasIslands, manifest } = await buildNotaFile(args.input, {
      title: args.title
    });
    writeFileSync(outPath, html, "utf8");
    const islandNote = hasIslands
      ? `${Object.keys(manifest).length} island(s), client bundle inlined`
      : "zero-JS (island-free)";
    process.stdout.write(`nota: wrote ${basename(outPath)} — ${islandNote}\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`nota: build failed\n${message}\n`);
    process.exit(1);
  }
}

main().catch(err => {
  process.stderr.write(
    `nota: ${err instanceof Error ? err.stack : String(err)}\n`
  );
  process.exit(1);
});

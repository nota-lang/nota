/**
 * **`@nota-lang/cli` entrypoint** — `nota build doc.nota → doc/` (a document directory).
 *
 * The simplest Nota integrator: one `.nota` file → one **document directory** (`index.html` +
 * `assets/`), built with Vite under a default config — so doc-relative imports, `?url` assets, and
 * CSS imports work as in any Vite app. Its page policy is trivial — the input file is the page.
 * All the work is in {@link "./build".buildNotaFile}; this is the thin argv/IO shell.
 *
 * Usage:
 * ```
 * nota build <doc.nota> [-o <outdir>] [--title <t>] [--setup <file>]
 * ```
 * With no `-o`, the output directory is the input with its extension stripped
 * (`doc.nota → doc/`).
 */

import { relative } from "node:path";
import { buildNotaFile } from "./build";

const USAGE = `nota — build a .nota document into a web page directory (index.html + assets/)

Usage:
  nota build <doc.nota> [options]

Options:
  -o, --out <dir>      output directory (default: input with its extension
                       stripped — doc.nota → doc/)
  --title <title>      document <title> (default: the input basename)
  --setup <file>       site setup module: lstset / mathset / secset / bibset
                       run before render (server and client)
  --static             zero-JS page: skip the client build + all scripts
                       (definition refs degrade to anchor jumps; widgets inert)
  -h, --help           show this help
`;

interface Args {
  command?: string;
  input?: string;
  out?: string;
  title?: string;
  setup?: string;
  static: boolean;
  help: boolean;
}

/** Minimal argv parser (no dependency): `nota build in.nota -o out/ --title T`. */
function parseArgs(argv: string[]): Args {
  const args: Args = { help: false, static: false };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      args.help = true;
    } else if (a === "-o" || a === "--out") {
      args.out = argv[++i];
    } else if (a === "--title") {
      args.title = argv[++i];
    } else if (a === "--setup") {
      args.setup = argv[++i];
    } else if (a === "--static") {
      args.static = true;
    } else {
      rest.push(a);
    }
  }
  args.command = rest[0];
  args.input = rest[1];
  return args;
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

  try {
    const out = await buildNotaFile(args.input, {
      title: args.title,
      setupModule: args.setup,
      static: args.static,
      outDir: args.out
    });
    // Prefer a readable relative path; fall back to absolute when the out dir isn't below cwd.
    const rel = relative(process.cwd(), out.outDir) || ".";
    const where = rel.startsWith("..") ? out.outDir : rel;
    const cssNote =
      out.cssFiles.length > 0 ? `, ${out.cssFiles.length} css file(s)` : "";
    const modeNote = out.hydrated
      ? `hydrating Solid app${cssNote}`
      : `zero-JS (static)${cssNote}`;
    process.stdout.write(`nota: wrote ${where}/index.html — ${modeNote}\n`);
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

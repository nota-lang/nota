# Nota — orientation for Claude

Nota is a document language: `@`-syntax markup (after Pollen/Scribble) that lowers to **hyperscript**
(`h`/`Fragment`/`decode` calls, NOT JSX) for any JSX framework (React, Solid), with a Pollen-style
`decode` pass that runs during SSG.

## Read first
- **`design/contract.md`** — the authoritative, reconciled cross-stream spec. Read it before touching
  any package. It pins the emit surface, the runtime semantics, and all locked cross-cutting decisions,
  and supersedes the design docs where they conflict.
- `design/notation.md` (surface syntax → emit), `design/decode.md` (runtime decode/SSG model),
  `design/implementation.md` (the phased build plan). Authority: implementation.md → contract.md →
  notation/decode.

## Repo layout
- **`oxc/`** — a **separate git repo** (a fork of oxc, branch `nota`) hosting the Nota *reader*. It is
  gitignored here and committed independently. Its implementation memory is `oxc/NOTA_READER.md`.
- **`packages/*`** — the `@nota-lang/*` TypeScript packages (runtime, react, solid, vscode-nota, …),
  a **Depot** + pnpm workspace.
- `references/` — external reference repos (mdx, typst, scribble, pollen, oxc); gitignored.

## Tooling
- **Depot, per-package only:** `cd packages/<pkg> && depot test` (or `depot --package @nota-lang/<pkg>
  test`). Do NOT run bare `depot test` from the repo root — a biome 2.x root-config conflict makes
  whole-workspace runs fail (per-package is clean). `depot test` type-checks + lints + runs vitest.
- **Rust:** `cargo test` inside `oxc/` (incremental ~10s after first build).

## Build status & method
The build is orchestrated wave-by-wave per `design/implementation.md` (Parts 1–5: reader, runtime,
vite plugin, cli/playground, IDE). Each feature ships with tests, green before the next phase.

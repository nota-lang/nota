# Emacs support for Nota

`nota-mode.el` provides:

- **`nota-mode`** for `.nota` files: a conservative "never lie" font-lock
  tier (a transliteration of the vscode-nota TextMate grammar) that only
  paints what is line-locally decidable. Fenced regions (` ``` `, `$$`,
  `%%%`, `|{ … }|`) are suppressed via `syntax-propertize` so inline rules
  cannot misfire inside them.
- **Native embedded JS/TS fontification** — the Emacs analogue of the
  TextMate grammar's `source.ts` delegation: `%` statement-line rests,
  `%%%` fence interiors, and ` ```ts/js/json ` code-fence interiors are
  fontified by the real `typescript-ts-mode`/`js-ts-mode`/`json-ts-mode`
  (org-src style, falling back to `js-mode` without tree-sitter grammars;
  other fence languages keep the raw paint). Disable with
  `nota-fontify-embedded`.
- **eglot wiring** for `@nota-lang/language-server` (the Volar server:
  virtual `.tsx` + reader `CodeMapping`s → the stock TS language service).
  Hover, completion, diagnostics, definition, rename, etc. all map back to
  `.nota` ranges.

## Setup

Build the server once (requires node + pnpm):

```bash
pnpm install
cd packages/language-server && depot build
```

Then in your init:

```elisp
(use-package nota-mode
  :load-path "/path/to/nota/editors/emacs"
  :hook (nota-mode . eglot-ensure))
```

When `nota-mode.el` is loaded from this repo, it launches the server as
`node packages/language-server/dist/bin.js --stdio` automatically; outside
the repo it expects a `nota-language-server` binary on `exec-path`.
Customize `nota-language-server-command` to override.

Full-fidelity highlighting comes from the server's reader-driven LSP
semantic tokens. Stock eglot does not consume semantic tokens; install
[`eglot-semtok`](https://github.com/futurepaul/eglot-semtok) (or any
semantic-tokens frontend) to layer them over the first-paint tier.

## Tests

```bash
cd editors/emacs
emacs -Q --batch -L . -l tests/nota-mode-test.el -f ert-run-tests-batch-and-exit
emacs -Q --batch -L . -l tests/eglot-smoke.el   # e2e against the built server
```

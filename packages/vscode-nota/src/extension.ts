import type * as vscode from "vscode";

// Phase U: the Nota VSCode extension is a *thin client*. The language is
// registered and the TextMate grammar applied entirely declaratively via the
// `contributes.languages` and `contributes.grammars` keys in package.json, so
// activation has nothing to do yet.
//
// The semantic layer (Volar language server: diagnostics, hover, completion,
// go-to-def, rename, semantic tokens) lands in Phases V-X and will be launched
// from here. Until then this stub keeps the extension valid and gives the later
// phases their entry point.

export function activate(_context: vscode.ExtensionContext): void {
  // No-op for Phase U. (Grammar + language registration is declarative.)
}

export function deactivate(): void {
  // No server to tear down yet.
}

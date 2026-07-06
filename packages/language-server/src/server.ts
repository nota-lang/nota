/**
 * The Nota Volar **language server**.
 *
 * Wires the standard Volar node server: a `createConnection` + `createServer`, a TypeScript project
 * (`createTypeScriptProject`) that registers {@link notaLanguagePlugin} so the TS language service
 * runs over each `.nota`'s virtual `.tsx`, and the `volar-service-typescript` language-service
 * plugins that surface diagnostics / hover / completion / definition / references / rename. The same
 * wiring carries all of those features over the single virtual-code mapping.
 *
 * **Source-document routing (contract-bug fix).** Volar's `languageFeatureWorker` only offers the
 * *embedded* virtual `.tsx` to service plugins once a script has generated code — which every `.nota`
 * does. So the three Nota service plugins (which guard on `languageId === "nota"` and want the SOURCE
 * doc: reader-driven semantic tokens, `@|` completions, and markup-positioned syntax diagnostics)
 * never fire through the plugin channel. There is no per-plugin opt-in for the source doc, so we route
 * those three features at the **connection level** ({@link registerNotaConnectionFeatures}), reusing
 * the plugins' pure logic. Everything else (hover, definition, TS completion/diagnostics, rename, …)
 * still flows through Volar's normal service-plugin path over the virtual `.tsx`.
 *
 * This module exports {@link startServer} (idempotent given a connection) so the thin `bin.ts` entry
 * and any embedder can boot it; `bin.ts` is the executable the `vscode-nota` client launches.
 */

import {
  type CompletionItem,
  type Connection,
  createConnection,
  createServer,
  createTypeScriptProject,
  type InitializeResult,
  InsertReplaceEdit,
  InsertTextFormat,
  type LanguageServer,
  type Position,
  type SemanticToken,
  type SemanticTokensLegend,
  TextEdit
} from "@volar/language-server/node.js";
import ts from "typescript";
import { create as createTypeScriptServices } from "volar-service-typescript";
import { URI } from "vscode-uri";
import {
  headCompletions,
  headContext,
  notaCompletionsPlugin
} from "./completions.js";
import {
  notaDiagnosticsServicePlugin,
  notaSyntaxDiagnostics
} from "./diagnostics.js";
import { NOTA_LANGUAGE_ID, notaLanguagePlugin } from "./language-plugin.js";
import {
  encodeSemanticTokens,
  notaSemanticTokens,
  notaSemanticTokensPlugin
} from "./semantic-tokens.js";

/** True for a source `.nota` URI (the client always sends the source doc for top-level requests). */
function isNotaUri(uri: URI): boolean {
  return uri.path.endsWith(`.${NOTA_LANGUAGE_ID}`);
}

/** The current text of an open document by string URI (synchronous — the doc is open at request time). */
function documentText(server: LanguageServer, uri: string): string | undefined {
  return server.documents.get(URI.parse(uri))?.getText();
}

/** The line-prefix (line start → `position`) of `text`, for the `@|` head-context classifier. */
function linePrefixAt(text: string, position: Position): string {
  const line = text.split("\n")[position.line] ?? "";
  return line.slice(0, position.character);
}

/**
 * Port of Volar's private `handleCompletionItem`: downgrade snippet / insert-replace edits when the
 * client did not advertise support (VS Code advertises both, but a bare LSP client may not). Applied
 * to the TS items so overriding `onCompletion` does not regress capability-gating.
 */
function handleCompletionItem(
  server: LanguageServer,
  item: CompletionItem
): CompletionItem {
  const cap =
    server.initializeParams?.capabilities.textDocument?.completion
      ?.completionItem;
  const snippetSupport = cap?.snippetSupport ?? false;
  const insertReplaceSupport = cap?.insertReplaceSupport ?? false;
  if (!snippetSupport && item.insertTextFormat === InsertTextFormat.Snippet) {
    item.insertTextFormat = InsertTextFormat.PlainText;
    if (item.insertText) {
      item.insertText = item.insertText.replace(/\$\d+/g, "");
      item.insertText = item.insertText.replace(/\${\d+:([^}]*)}/g, "");
    }
  }
  if (
    !insertReplaceSupport &&
    item.textEdit &&
    InsertReplaceEdit.is(item.textEdit)
  ) {
    item.textEdit = TextEdit.replace(
      item.textEdit.insert,
      item.textEdit.newText
    );
  }
  return item;
}

/**
 * Register the connection-level handlers that carry the three source-document Nota features Volar's
 * service-plugin channel cannot route (see the module doc). Called once, right after
 * `server.initialize` has run Volar's own registrations, so these **override** Volar's handlers for
 * the same JSON-RPC methods (`onRequest` is last-write-wins in `vscode-jsonrpc`). Non-`.nota` URIs
 * delegate to the language service exactly as Volar would; `.nota` URIs get the Nota behaviour merged
 * on top.
 *
 * @param connection   the LSP connection
 * @param server       the booted Volar server (for `project.getLanguageService`, `documents`, params)
 * @param capabilities the merged server capabilities Volar just populated (for the semantic legend)
 */
function registerNotaConnectionFeatures(
  connection: Connection,
  server: LanguageServer,
  capabilities: InitializeResult["capabilities"]
): void {
  // ---- Semantic tokens (reader-driven for `.nota`, TS-mapped otherwise). --------------------------
  // Index the reader tokens against the MERGED legend the server actually advertised (TS types first,
  // then ours) — NOT the plugin-local legend. Last-good cache mirrors the plugin (serve prior tokens
  // when a mid-edit source fails to parse).
  const legend: SemanticTokensLegend | undefined =
    capabilities.semanticTokensProvider?.legend;
  const semanticCache = new Map<string, SemanticToken[]>();
  const readerTokens = (uriStr: string): SemanticToken[] => {
    const text = documentText(server, uriStr) ?? "";
    try {
      const tokens = notaSemanticTokens(text);
      semanticCache.set(uriStr, tokens);
      return tokens;
    } catch {
      return semanticCache.get(uriStr) ?? [];
    }
  };

  if (legend) {
    connection.languages.semanticTokens.on(
      async (params, token, _wd, progress) => {
        const uri = URI.parse(params.textDocument.uri);
        if (isNotaUri(uri)) {
          return encodeSemanticTokens(
            readerTokens(params.textDocument.uri),
            legend
          );
        }
        const ls = await server.project.getLanguageService(uri);
        return (
          (await ls.getSemanticTokens(
            uri,
            undefined,
            legend,
            t => progress?.report(t),
            token
          )) ?? {
            data: []
          }
        );
      }
    );
    connection.languages.semanticTokens.onRange(
      async (params, token, _wd, progress) => {
        const uri = URI.parse(params.textDocument.uri);
        if (isNotaUri(uri)) {
          const lo = params.range.start.line;
          const hi = params.range.end.line;
          const inRange = readerTokens(params.textDocument.uri).filter(
            t => t[0] >= lo && t[0] <= hi
          );
          return encodeSemanticTokens(inRange, legend);
        }
        const ls = await server.project.getLanguageService(uri);
        return (
          (await ls.getSemanticTokens(
            uri,
            params.range,
            legend,
            t => progress?.report(t),
            token
          )) ?? {
            data: []
          }
        );
      }
    );
  }

  // ---- Completion (TS items always; `@|` head items merged additively for `.nota`). --------------
  // Overriding `onCompletion` bypasses Volar's own item bookkeeping, so we track the language service
  // ourselves for `onCompletionResolve`.
  let lastCompleteLs: Awaited<
    ReturnType<typeof server.project.getLanguageService>
  > | null = null;
  connection.onCompletion(async (params, token) => {
    const uri = URI.parse(params.textDocument.uri);
    const ls = await server.project.getLanguageService(uri);
    lastCompleteLs = ls;
    const list = (await ls.getCompletionItems(
      uri,
      params.position,
      params.context,
      token
    )) ?? { isIncomplete: false, items: [] };
    list.items = list.items.map(item => handleCompletionItem(server, item));
    if (isNotaUri(uri)) {
      const text = documentText(server, params.textDocument.uri) ?? "";
      const prefix = linePrefixAt(text, params.position);
      // `@|` markup head → offer host tags + prelude slots + in-scope components (the reader-owned
      // surface TS cannot see; markup positions come back empty from TS, so the merge is additive).
      if (headContext(prefix) !== null) {
        const seen = new Set(list.items.map(i => i.label));
        for (const item of headCompletions(text)) {
          if (!seen.has(item.label)) {
            list.items.push(item);
          }
        }
      }
    }
    return list;
  });
  connection.onCompletionResolve(async (item, token) =>
    lastCompleteLs
      ? await lastCompleteLs.resolveCompletionItem(item, token)
      : item
  );
}

/**
 * Intercept `connection.sendDiagnostics` so that every push for a `.nota` document carries the Nota
 * **syntax** diagnostics merged onto Volar's TS diagnostics. Volar publishes diagnostics on the push
 * channel (this server advertises no pull `diagnosticProvider` because the TS plugin declares
 * inter-file dependencies), and markup-positioned Nota errors are unmappable into the virtual `.tsx`,
 * so the service-plugin channel cannot carry them — this single choke point is where the two disjoint
 * streams (TS over the virtual, Nota syntax over the source) reliably combine, with no last-writer
 * race. Recomputed per push, so the Nota errors track the current source (and clear when it is fixed).
 */
function interceptDiagnostics(
  connection: Connection,
  server: LanguageServer
): void {
  const original = connection.sendDiagnostics.bind(connection);
  connection.sendDiagnostics = params => {
    if (params.uri.endsWith(`.${NOTA_LANGUAGE_ID}`)) {
      const text = documentText(server, params.uri);
      if (text !== undefined) {
        const nota = notaSyntaxDiagnostics(text);
        if (nota.length > 0) {
          return original({
            ...params,
            // `notaSyntaxDiagnostics` and `sendDiagnostics` resolve `Diagnostic` through two
            // structurally-identical `vscode-languageserver-types` copies in the tree — assert the
            // merged array back to the connection's expected element type.
            diagnostics: [
              ...params.diagnostics,
              ...(nota as typeof params.diagnostics)
            ]
          });
        }
      }
    }
    return original(params);
  };
}

/**
 * Boot the language server on a Volar `Connection`. Registers the connection lifecycle handlers and
 * starts listening. Defaults to a fresh `createConnection()` (the standard stdio/IPC connection the
 * editor client launches).
 *
 * @param connection the LSP connection (defaults to `createConnection()`)
 */
export function startServer(connection: Connection = createConnection()): void {
  const server = createServer(connection);

  // Merge Nota syntax diagnostics into every `.nota` push before it leaves the connection.
  interceptDiagnostics(connection, server);

  connection.onInitialize(params => {
    const result = server.initialize(
      params,
      // A TS project so the TS language service runs over the virtual `.tsx`. The reader's emit +
      // shifted mappings come from `notaLanguagePlugin`; `volar-service-typescript` is what actually
      // produces TS diagnostics/hover/etc. over the virtual file.
      createTypeScriptProject(ts, undefined, () => ({
        languagePlugins: [notaLanguagePlugin]
      })),
      // `volar-service-typescript` surfaces *type* diagnostics/hover/completion over the virtual
      // `.tsx` (incl. `@tag[|` prop completions through the recovery anchor mapping). The Nota service
      // plugins still register their *capabilities* here (so the merged server legend + completion
      // trigger characters + diagnostic provider are advertised), but their source-document *requests*
      // are routed at the connection level below — Volar never offers them the source doc.
      [
        ...createTypeScriptServices(ts),
        notaDiagnosticsServicePlugin,
        notaSemanticTokensPlugin,
        notaCompletionsPlugin
      ]
    );
    // Volar has now registered its own connection handlers (inside the initialize callbacks); override
    // the three source-document features on top, indexing semantic tokens against the merged legend
    // Volar just built into `result.capabilities`.
    registerNotaConnectionFeatures(connection, server, result.capabilities);
    return result;
  });

  connection.onInitialized(() => server.initialized());
  connection.onShutdown(() => server.shutdown());

  connection.listen();
}

/**
 * The **transport-agnostic** core of the Nota Volar language server, shared by the node (stdio)
 * entry (`./server.ts` → `bin.ts`) and the browser worker entry (`./browser.ts`).
 *
 * **Source-document routing.** Volar's `languageFeatureWorker` only offers the
 * *embedded* virtual `.tsx` to service plugins once a script has generated code — which every `.nota`
 * does. So the three Nota service plugins (which guard on `languageId === "nota"` and want the SOURCE
 * doc: reader-driven semantic tokens, `@|` completions, and markup-positioned syntax diagnostics)
 * never fire through the plugin channel. There is no per-plugin opt-in for the source doc, so we route
 * those three features at the **connection level** ({@link registerNotaConnectionFeatures}), reusing
 * the plugins' pure logic. Everything else (hover, definition, TS completion/diagnostics, rename, …)
 * still flows through Volar's normal service-plugin path over the virtual `.tsx`.
 *
 * Platform neutrality: values are imported from `@volar/language-server/protocol.js` (whose
 * `vscode-languageserver-protocol` dependency self-routes node/browser via package export
 * conditions); the `Connection`/`LanguageServer` types are structural and shared by both entries.
 */

import type {
  CompletionItem,
  Connection,
  InitializeResult,
  LanguageServer,
  LanguageServerProject,
  Position,
  SemanticToken,
  SemanticTokensLegend
} from "@volar/language-server/index.js";
import {
  InsertReplaceEdit,
  InsertTextFormat,
  TextEdit
} from "@volar/language-server/protocol.js";
import type ts from "typescript";
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
import { NOTA_LANGUAGE_ID } from "./language-plugin.js";
import { literalFenceLines } from "./line-context.js";
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

/**
 * The event-listener shape {@link LastGoodCache} needs to hook eviction — a narrow structural subset
 * of Volar's `documents.onDidClose` (itself a `vscode.Event<TextDocumentChangeEvent<SnapshotDocument>>`
 * — a function taking a listener, with extra optional params this never passes), loose enough that a
 * test can hand it a minimal stub instead of a real Volar `LanguageServer`.
 */
interface CloseSource {
  onDidClose(listener: (e: { document: { uri: string } }) => void): unknown;
}

/**
 * A per-document "last good" value cache that evicts on close. Without this, a URI's last-good value
 * sits in this Map for the rest of the server process even after its document closes (or — a scratch
 * file renamed/deleted mid-session — will never reopen under that URI again). Wiring
 * `documents.onDidClose` in the constructor (rather than inline where the cache is used, as a prior
 * version did) makes the eviction directly unit-testable against a minimal {@link CloseSource} stub
 * (`tests/server-core.test.ts`), without a real Volar `Connection`/`LanguageServer`.
 */
export class LastGoodCache<T> {
  private readonly byUri = new Map<string, T>();

  constructor(documents: CloseSource) {
    documents.onDidClose(({ document }) => {
      this.byUri.delete(document.uri);
    });
  }

  get(uri: string): T | undefined {
    return this.byUri.get(uri);
  }

  set(uri: string, value: T): void {
    this.byUri.set(uri, value);
  }
}

/** The line-prefix (line start → `position`) of `text`, for the `@|` head-context classifier. */
function linePrefixAt(text: string, position: Position): string {
  const line = text.split("\n")[position.line] ?? "";
  return line.slice(0, position.character);
}

/**
 * Whether `@|` head completions ({@link headCompletions}) should be merged in at `position` within
 * `text`: {@link headContext} accepts the line-prefix AND `position`'s line is not inside a literal
 * fence interior. `headContext` only ever sees a single line's prefix — it cannot tell whether that
 * line sits inside a still-open multi-line `%%%`/code fence — so that half of the check needs the
 * full document, which only this call site has ({@link literalFenceLines}, `./line-context.js`; see
 * its doc for why a fence interior is suppressed even though `@` is grammar-legal there). Exported
 * and unit-tested directly (`tests/completions.test.ts`) since it is the actual decision
 * `connection.onCompletion` below makes, not just a re-implementation of it.
 */
export function shouldOfferHeadCompletions(
  text: string,
  position: Position
): boolean {
  return (
    headContext(linePrefixAt(text, position)) !== null &&
    !literalFenceLines(text).has(position.line)
  );
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
  // then ours) — NOT the plugin-local legend (`notaSemanticTokensPlugin`'s own `create()` is a
  // capability-only stub — see its doc — so this is the ONE last-good cache, not a mirror of another).
  const legend: SemanticTokensLegend | undefined =
    capabilities.semanticTokensProvider?.legend;
  const semanticCache = new LastGoodCache<SemanticToken[]>(server.documents);
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
      // `@|` markup head → offer host tags + prelude slots + in-scope components (the reader-owned
      // surface TS cannot see; markup positions come back empty from TS, so the merge is additive).
      if (shouldOfferHeadCompletions(text, params.position)) {
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
 * Wire the Nota server onto a Volar `Connection`/`LanguageServer` pair and start listening. The
 * caller supplies the platform pieces: the connection (stdio in node, postMessage in a worker), the
 * Volar server, the project (a TS project over the platform's filesystem story), and the `typescript`
 * module (for `volar-service-typescript`).
 */
export function initializeNotaServer(
  connection: Connection,
  server: LanguageServer,
  project: LanguageServerProject,
  tsModule: typeof ts
): void {
  // Merge Nota syntax diagnostics into every `.nota` push before it leaves the connection.
  interceptDiagnostics(connection, server);

  connection.onInitialize(params => {
    const result = server.initialize(
      params,
      // A TS project so the TS language service runs over the virtual `.tsx`. The reader's emit +
      // shifted mappings come from `notaLanguagePlugin`; `volar-service-typescript` is what actually
      // produces TS diagnostics/hover/etc. over the virtual file.
      project,
      // `volar-service-typescript` surfaces *type* diagnostics/hover/completion over the virtual
      // `.tsx` (incl. `@tag[|` prop completions through the recovery anchor mapping). The Nota service
      // plugins still register their *capabilities* here (so the merged server legend + completion
      // trigger characters + diagnostic provider are advertised), but their source-document *requests*
      // are routed at the connection level below — Volar never offers them the source doc.
      [
        ...createTypeScriptServices(tsModule),
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

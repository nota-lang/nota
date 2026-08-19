/** Shared node/browser server wiring around Volar's virtual TSX service. */

import type {
  CompletionItem,
  Connection,
  InitializeResult,
  LanguageServer,
  LanguageServerProject,
  Position,
  Range,
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
import {
  classifyLines,
  type LineClassification,
  literalFenceLines
} from "./line-context.js";
import {
  encodeSemanticTokens,
  notaSemanticTokens,
  notaSemanticTokensPlugin
} from "./semantic-tokens.js";

function isNotaUri(uri: URI): boolean {
  return uri.path.endsWith(`.${NOTA_LANGUAGE_ID}`);
}

function documentText(server: LanguageServer, uri: string): string | undefined {
  return server.documents.get(URI.parse(uri))?.getText();
}

interface CloseSource {
  onDidClose(listener: (e: { document: { uri: string } }) => void): unknown;
}

/** A per-document last-good cache that evicts closed documents. */
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

function linePrefixAt(text: string, position: Position): string {
  let start = 0;
  for (let line = 0; line < position.line; line++) {
    const newline = text.indexOf("\n", start);
    if (newline < 0) {
      return "";
    }
    start = newline + 1;
  }
  return text.slice(start, start + position.character);
}

/** Whether `position` is an `@` head outside a literal fence. */
export function shouldOfferHeadCompletions(
  text: string,
  position: Position,
  lines: LineClassification = classifyLines(text)
): boolean {
  return (
    headContext(linePrefixAt(text, position)) !== null &&
    !literalFenceLines(text, lines).has(position.line)
  );
}

/** Keep single-line semantic tokens that intersect an LSP range. */
export function semanticTokensInRange(
  tokens: readonly SemanticToken[],
  range: Range
): SemanticToken[] {
  return tokens.filter(([line, character, length]) => {
    const endsAfterStart =
      line > range.start.line ||
      (line === range.start.line && character + length > range.start.character);
    const startsBeforeEnd =
      line < range.end.line ||
      (line === range.end.line && character < range.end.character);
    return endsAfterStart && startsBeforeEnd;
  });
}

/** Match Volar's capability downgrades for our overridden completion handler. */
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

/** Register source-level features that Volar only routes to the generated document. */
function registerNotaConnectionFeatures(
  connection: Connection,
  server: LanguageServer,
  capabilities: InitializeResult["capabilities"]
): void {
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
          const inRange = semanticTokensInRange(
            readerTokens(params.textDocument.uri),
            params.range
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

  // Volar also keeps the most recent language service for completion resolution.
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
      const lines = classifyLines(text);
      if (shouldOfferHeadCompletions(text, params.position, lines)) {
        const seen = new Set(list.items.map(i => i.label));
        for (const item of headCompletions(text, lines)) {
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

/** Merge source-level reader errors into Volar's pushed TS diagnostics. */
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

/** Initialize a Nota server over the supplied transport and TypeScript project. */
export function initializeNotaServer(
  connection: Connection,
  server: LanguageServer,
  project: LanguageServerProject,
  tsModule: typeof ts
): void {
  interceptDiagnostics(connection, server);

  connection.onInitialize(params => {
    const result = server.initialize(params, project, [
      ...createTypeScriptServices(tsModule),
      notaDiagnosticsServicePlugin,
      notaSemanticTokensPlugin,
      notaCompletionsPlugin
    ]);
    registerNotaConnectionFeatures(connection, server, result.capabilities);
    return result;
  });

  connection.onInitialized(() => server.initialized());
  connection.onShutdown(() => server.shutdown());

  connection.listen();
}

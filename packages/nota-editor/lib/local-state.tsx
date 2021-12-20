import { is_err, ok } from "@nota-lang/nota-common";
import { try_parse, nota_parser, translate_ast } from "@nota-lang/nota-syntax";
import { makeAutoObservable, reaction, runInAction } from "mobx";
import * as babel from "@babel/standalone";
import type { BabelFileResult } from "@babel/core";

import { TranslationResult, State } from "./nota-editor";

export class LocalState implements State {
  contents: string;
  translation: TranslationResult;
  ready: boolean = true;

  try_translate(): TranslationResult {
    let tree = try_parse(nota_parser, this.contents);
    if (is_err(tree)) {
      return tree;
    }
    let js = translate_ast(this.contents, tree.value);
    let transpiled_result = babel.transformFromAst(js, undefined, {}) as any as BabelFileResult;
    let lowered_result = babel.transformFromAst(js, undefined, {
      presets: [["env", { targets: { browsers: "last 1 safari version" } }]],
    }) as any as BabelFileResult;
    let lowered = `let exports = {};\n${lowered_result.code}\nlet nota_document = exports;`;
    return ok({
      transpiled: transpiled_result.code!,
      lowered,
    });
  }

  constructor(contents: string) {
    this.contents = contents;
    this.translation = this.try_translate();

    makeAutoObservable(this);

    let needs_sync = false;
    reaction(
      () => [this.contents],
      () => {
        needs_sync = true;
      }
    );

    const SYNC_INTERVAL = 200;
    setInterval(async () => {
      if (needs_sync) {
        let translation = this.try_translate();
        needs_sync = false;
        runInAction(() => {
          this.translation = translation;
        });
      }
    }, SYNC_INTERVAL);
  }
}

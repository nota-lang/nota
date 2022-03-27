import { is_err, err, ok } from "@nota-lang/nota-common";
import { try_parse, translate_ast, optimize_plugin } from "@nota-lang/nota-syntax";
import { makeAutoObservable, reaction, runInAction } from "mobx";
import * as babel from "@babel/standalone";
import type { BabelFileResult } from "@babel/core";

import { TranslationResult, State } from ".";

export class LocalState implements State {
  contents: string;
  translation: TranslationResult;
  ready: boolean = true;

  try_translate(): TranslationResult {
    let tree = try_parse(this.contents);
    if (is_err(tree)) {
      return err(tree.value.stack!);
    }
    let js = translate_ast(this.contents, tree.value);
    let transpiled_result = babel.transformFromAst(js, undefined, {
      plugins: [optimize_plugin],
    }) as any as BabelFileResult;
    let lowered_result = babel.transformFromAst(js, undefined, {
      presets: [["env", { targets: { browsers: "last 1 safari version" } }]],
    }) as any as BabelFileResult;
    let lowered = `let exports = {};\n${lowered_result.code}\nlet nota_document = exports;`;
    return ok({
      transpiled: transpiled_result.code!,
      lowered,
      css: null,
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

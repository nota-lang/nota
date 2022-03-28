import { isErr, err, ok } from "@nota-lang/nota-common";
import { tryParse, translateAst, optimizePlugin } from "@nota-lang/nota-syntax";
import { makeAutoObservable, reaction, runInAction } from "mobx";
import * as babel from "@babel/standalone";
import type { BabelFileResult } from "@babel/core";

import { TranslationResult, State } from ".";

export class LocalState implements State {
  contents: string;
  translation: TranslationResult;
  ready: boolean = true;

  tryTranslate(): TranslationResult {
    let tree = tryParse(this.contents);
    if (isErr(tree)) {
      return err(tree.value.stack!);
    }
    let js = translateAst(this.contents, tree.value);
    let transpiledResult = babel.transformFromAst(js, undefined, {
      plugins: [optimizePlugin],
    }) as any as BabelFileResult;
    let loweredResult = babel.transformFromAst(js, undefined, {
      presets: [["env", { targets: { browsers: "last 1 safari version" } }]],
    }) as any as BabelFileResult;
    let lowered = `let exports = {};\n${loweredResult.code}\nlet notaDocument = exports;`;
    return ok({
      transpiled: transpiledResult.code!,
      lowered,
      css: null,
    });
  }

  constructor(contents: string) {
    this.contents = contents;
    this.translation = this.tryTranslate();

    makeAutoObservable(this);

    let needsSync = false;
    reaction(
      () => [this.contents],
      () => {
        needsSync = true;
      }
    );

    const SYNC_INTERVAL = 200;
    setInterval(async () => {
      if (needsSync) {
        let translation = this.tryTranslate();
        needsSync = false;
        runInAction(() => {
          this.translation = translation;
        });
      }
    }, SYNC_INTERVAL);
  }
}

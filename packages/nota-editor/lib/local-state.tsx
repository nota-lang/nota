import type { BabelFileResult } from "@babel/core";
import * as babel from "@babel/standalone";
import { LanguageSupport } from "@codemirror/language";
import { err, isErr, ok } from "@nota-lang/nota-common/dist/result.js";
import { tryParse } from "@nota-lang/nota-syntax/dist/parse/mod.js";
import { optimizePlugin, translateAst } from "@nota-lang/nota-syntax/dist/translate/mod.js";
import { makeAutoObservable, reaction, runInAction } from "mobx";

import { State, TranslationResult } from ".";
import { GLOBAL_NAME } from "./dynamic-load";

export class LocalState implements State {
  contents: string;
  translation: TranslationResult;
  ready: boolean = true;
  availableLanguages: { [lang: string]: LanguageSupport } = {}; // TODO
  runtimeError?: Error = undefined;

  tryTranslate(): TranslationResult {
    let tree = tryParse(this.contents);
    if (isErr(tree)) {
      return err(tree.value.stack!);
    }
    let js = translateAst(this.contents, tree.value);
    let transpiledResult = babel.transformFromAst(js, undefined, {
      plugins: [optimizePlugin],
    }) as any as BabelFileResult;
    let transpiled = transpiledResult.code!;
    let loweredResult = babel.transform(transpiled, {
      presets: [["env", { targets: { browsers: "last 1 safari version" } }]],
    });
    let lowered = `var exports = {};\n${loweredResult.code}\nvar ${GLOBAL_NAME} = exports;`;
    return ok({
      transpiled,
      lowered,
      map: "", // todo
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

import * as babel from "@babel/standalone";
import { LanguageSupport } from "@codemirror/language";
import { err, isErr, ok } from "@nota-lang/nota-common/dist/result.js";
import { tryParse } from "@nota-lang/nota-syntax/dist/parse/mod.js";
import { translate } from "@nota-lang/nota-syntax/dist/translate/mod.js";
import { makeAutoObservable, reaction, runInAction } from "mobx";

import { State, TranslationResult } from ".";

export class LocalState implements State {
  contents: string;
  translation: TranslationResult;
  ready: boolean = true;
  rendered: boolean = false;
  availableLanguages: { [lang: string]: LanguageSupport } = {}; // TODO
  runtimeError?: Error = undefined;

  tryTranslate(): TranslationResult {
    let tree = tryParse(this.contents);
    if (isErr(tree)) {
      return err(tree.value.stack!);
    }
    let transpiledResult = translate({
      input: this.contents,
      tree: tree.value,
      inputPath: "<anon>",
    });
    let transpiled = transpiledResult.code;
    let loweredResult = babel.transform(transpiled, {
      presets: [["env", { modules: "cjs", targets: { browsers: "last 1 safari version" } }]],
      sourceMaps: true,
      inputSourceMap: transpiledResult.map,
    });
    let lowered = loweredResult.code!;
    return ok({
      transpiled,
      lowered,
      map: JSON.stringify(loweredResult.map!),
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

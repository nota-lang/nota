import * as babel from "@babel/standalone";
import { LanguageSupport } from "@codemirror/language";
import { err, isErr, ok } from "@nota-lang/nota-common/dist/result.js";
import { tryParse } from "@nota-lang/nota-syntax/dist/parse/mod.js";
import { translate } from "@nota-lang/nota-syntax/dist/translate/mod.js";
import _ from "lodash";
import { makeObservable, observable, reaction, runInAction } from "mobx";

import { State, TranslationResult } from ".";

export class LocalState implements State {
  contents: string;
  translation: TranslationResult;
  ready: boolean = true;
  rendered: boolean = false;
  availableLanguages: { [lang: string]: LanguageSupport } = {}; // TODO
  runtimeError?: Error = undefined;
  imports?: { [key: string]: any } = undefined;

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

  constructor({
    contents,
    imports,
    syncDelay,
  }: {
    contents: string;
    syncDelay?: number | ((contents: string) => number);
    imports?: { [key: string]: any };
  }) {
    this.contents = contents;
    this.imports = imports;
    this.translation = this.tryTranslate();

    makeObservable(this, {
      contents: observable,
      translation: observable.deep,
    });

    let needsSync = false;
    let lastEdit = _.now();
    reaction(
      () => [this.contents],
      () => {
        needsSync = true;
        lastEdit = _.now();
      }
    );

    let defaultSyncDelay = (contents: string) => Math.min(Math.sqrt(contents.length) * 10, 3000);

    let delayFunc = syncDelay
      ? typeof syncDelay === "number"
        ? () => syncDelay
        : syncDelay
      : defaultSyncDelay;

    setInterval(() => {
      if (!needsSync) return;

      let elapsed = _.now() - lastEdit;
      if (elapsed > delayFunc(this.contents)) {
        needsSync = false;
        let translation = this.tryTranslate();
        runInAction(() => {
          console.log("ok????", translation);
          this.translation = translation;
        });
      }
    }, 33);
  }
}

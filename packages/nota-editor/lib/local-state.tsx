import { is_err, ok } from "@wcrichto/nota-common";
import { try_parse, translate } from "@wcrichto/nota-syntax";
import { makeAutoObservable, reaction, runInAction } from "mobx";
import esbuild from "esbuild-wasm";
//@ts-ignore
import esbuildWasmURL from "esbuild-wasm/esbuild.wasm";

import { State } from "./state";
import type { TranslationResult } from "../bin/server";

export class LocalState implements State {
  contents: string = "";
  translation: TranslationResult = ok("");
  ready: boolean = false;

  async try_translate(): Promise<TranslationResult> {
    let tree = try_parse(this.contents);
    if (is_err(tree)) {
      return tree;
    }
    let js = translate(this.contents, tree.value);
    let output = await esbuild.transform(js, { format: "iife", globalName: "nota_document" });
    return ok(output.code);
  }

  constructor() {
    makeAutoObservable(this);
    esbuild
      .initialize({
        wasmURL: esbuildWasmURL,
      })
      .then(async () => {
        let translation = await this.try_translate();
        runInAction(() => {
          this.translation = translation;
          this.ready = true;
        });

        let needs_sync = false;
        reaction(
          () => [this.contents],
          () => {
            needs_sync = true;
          }
        );

        setInterval(async () => {
          if (needs_sync) {
            let translation = await this.try_translate();
            runInAction(() => {
              this.translation = translation;
            });
          }
        }, 200);
      });
  }
}

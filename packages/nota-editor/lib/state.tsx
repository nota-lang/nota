import React from "react";
import { makeAutoObservable, reaction, autorun, runInAction, observable, IObservableValue, makeObservable } from "mobx";
import * as nota_syntax from "@wcrichto/nota-syntax";
import * as nota from "@wcrichto/nota";
import type { Tree } from "@lezer/common";
import _ from "lodash";

export interface Ok<T> {
  type: "Ok";
  value: T;
}

export interface Err<E> {
  type: "Err";
  value: E;
}

export type Result<T, E = Error> = Ok<T> | Err<E>;

export let ok = <T,>(value: T): Ok<T> => ({ type: "Ok", value });
export let err = <E,>(value: E): Err<E> => ({ type: "Err", value });
export let is_ok = <T, E>(result: Result<T, E>): result is Ok<T> => result.type == "Ok";
export let is_err = <T, E>(result: Result<T, E>): result is Err<E> => result.type == "Err";

export class TranslateResult {
  contents: string;
  tree: Result<Tree>;
  translation?: Result<nota_syntax.Translation>;
  imports?: Result<{ [path: string]: string }>;
  Element?: Result<React.FC>;

  constructor(contents: string, tree: Result<Tree>) {
    this.contents = contents;
    this.tree = tree;
    makeAutoObservable(this);
  }
}

export interface ImportRequest {
  type: "Import";
  paths: string[];
}

export interface ContentsRequest {
  type: "Contents";
}

export interface SyncRequest {
  type: "Sync";
  contents: string;
}

export type Request = ImportRequest | ContentsRequest | SyncRequest;

export interface ImportResponse {
  type: "Import";
  imports: Result<string, string>;
}

export interface ContentsResponse {
  type: "Contents";
  contents: string;
}

export interface SyncResponse {
  type: "Sync";
  result: Result<any, string>;
}

export type Response = ContentsResponse | ImportResponse | SyncResponse;

export class State {
  contents: string = "";
  translation: TranslateResult | undefined = undefined;
  ready: boolean = false;

  private ws: WebSocket;
  private callbacks: { [type: string]: any[] } = {};

  constructor() {    
    this.ws = new WebSocket("ws://localhost:8000");

    this.ws.onerror = evt => {
      console.error(evt);
    };

    this.ws.onopen = async () => {
      let req: ContentsRequest = {
        type: "Contents",
      };
      let resp: ContentsResponse = await this.send_message(req);
      runInAction(() => {
        this.contents = resp.contents;
        this.ready = true;

        autorun(async () => {
          let req: SyncRequest = { type: "Sync", contents: this.contents };
          let resp: SyncResponse = await this.send_message(req);
          if (is_err(resp.result)) {
            console.error(resp.result.value);
          }
        });
      });
    };

    this.ws.onmessage = event => {
      let msg = JSON.parse(event.data);
      let cbs = this.callbacks[msg.type];
      console.assert(cbs !== undefined && cbs.length > 0);
      cbs = cbs.splice(0, cbs.length);
      cbs.forEach(cb => cb(msg));
    };

    makeAutoObservable(this);

    const TRANSLATE_DELAY = 1000;
    reaction(
      () => [this.ready, this.contents],
      _.debounce(async () => {
        if (this.ready) {
          let result = await this.run_translation(this.contents);
          runInAction(() => {
            this.translation = result;
          });
        }
      }, TRANSLATE_DELAY)
    );
  }

  send_message = async (req: any): Promise<any> => {
    let cb;
    let promise = new Promise((resolve, _reject) => {
      cb = resolve;
    });
    if (!(req.type in this.callbacks)) {
      this.callbacks[req.type] = [];
    }
    this.callbacks[req.type].push(cb);
    this.ws.send(JSON.stringify(req));
    return await promise;
  };

  run_translation = async (contents: string): Promise<TranslateResult> => {
    let parse = nota_syntax.parser.startParse(contents);
    let result: TranslateResult;

    while (true) {
      let tree = parse.advance();
      if (tree != null) {
        result = new TranslateResult(contents, ok(tree));
        break;
      } else if (parse.recovering) {
        let pos = parse.parsedPos - 1;
        let prefix = contents.slice(Math.max(0, pos - 10), pos);
        let suffix = contents.slice(pos + 1, pos + 10);
        let msg = `Invalid parse at: ${prefix}>>>${contents[pos]}<<<${suffix}`;
        if (parse.tokens.mainToken) {
          let token = nota_syntax.parser.getName(parse.tokens.mainToken.value);
          msg += ` (unexpected token ${token})`;
        }

        return new TranslateResult(contents, err(Error(msg)));
      }
    }

    try {
      result.translation = ok(await nota_syntax.translate(contents, result.tree.value as Tree));
    } catch (e: any) {
      console.error(e);
      result.translation = err(e);
      return result;
    }

    let paths = Array.from(result.translation.value.imports);
    if (paths.length > 0) {
      let request: ImportRequest = { type: "Import", paths };
      let response: ImportResponse = await this.send_message(request);
      if (is_ok(response.imports)) {
        try {
          let f = new Function(
            `return function(externals){
              var require = (name) => {return externals[name]}; 
              ${response.imports.value}; 
              return modules
            }`
          );
          let externals = {
            react: React,
            "@wcrichto/nota": nota,
            lodash: _,
          };
          let modules = f()(externals).modules;
          result.imports = ok(modules);
        } catch (e: any) {
          console.error(e);
          result.imports = err(Error(e.toString()));
          return result;
        }
      } else {
        result.imports = err(Error(response.imports.value));
        return result;
      }
    } else {
      result.imports = ok({});
    }

    try {
      let f: () => nota_syntax.TranslatedFunction = new Function(
        `return(${result.translation!.value.js})`
      ) as any;
      let symbols = { React, ...nota };
      result.Element = ok(() => f()(symbols, result.imports!.value));
    } catch (e: any) {
      console.error(e);
      result.Element = err(e);
      return result;
    }

    return result;
  };
}

export let StateContext = React.createContext<State | null>(null);

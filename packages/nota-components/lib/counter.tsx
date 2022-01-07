import { action, makeAutoObservable } from "mobx";
import React from "react";
import _ from "lodash";

export type NumberStyle = "1" | "a";

export class CounterPosition {
  stack: number[];
  styles: NumberStyle[];

  constructor(stack: number[], styles: NumberStyle[]) {
    this.stack = stack;
    this.styles = styles;
  }

  level = (): number => this.stack.length;

  stylize = (n: number, style: NumberStyle): string => {
    if (style == "1") {
      return n.toString();
    } else if (style == "a") {
      let char_code = "a".charCodeAt(0) + n - 1;
      return String.fromCharCode(char_code);
    } else {
      throw `Bad style ${style}`;
    }
  };

  to_string = (): string =>
    this.stack.map((n, i) => this.stylize(n, this.styles[i % this.styles.length])).join(".");
}

export interface ValueStack {
  value: any,
  children: ValueStack[]
}

export class NestedCounter {
  stack: number[];
  styles: NumberStyle[];
  values: ValueStack[] = [];

  constructor(styles: NumberStyle[] = ["1"]) {
    this.stack = [0];
    this.styles = styles;
    makeAutoObservable(this);
  }

  save_value = action((value: any) => {
    let a = this.stack.slice(0, -2).reduce(a => _.last(a)!.children, this.values);
    _.last(a)!.value = value;
  });

  position = (): CounterPosition => new CounterPosition(this.stack.slice(0, -1), this.styles);

  push = (): CounterPosition => {
    this.stack
      .slice(0, -1)
      .reduce(a => _.last(a)!.children, this.values)
      .push({
        value: undefined,
        children: [],
      });

    this.stack.push(0);

    return this.position();
  };

  Pop: React.FC = () => {
    this.stack.pop();
    this.stack[this.stack.length - 1] += 1;
    return null;
  };
}

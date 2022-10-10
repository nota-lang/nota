import _ from "lodash";
import React from "react";

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
      let charCode = "a".charCodeAt(0) + n - 1;
      return String.fromCharCode(charCode);
    } else {
      throw new Error(`Bad style ${style}`);
    }
  };

  toString = (): string => {
    let parts: string[] = [];
    this.stack.forEach((n, i) => {
      let style = this.styles[i % this.styles.length];
      let s = this.stylize(n, style);
      if (i > 0 && style != "a") {
        parts.push(".");
      }
      parts.push(s);
    });
    return parts.join("");
  };
}

export interface ValueStack {
  value: any;
  enumerated: boolean;
  children: ValueStack[];
}

export class NestedCounter {
  stack: number[];
  styles: NumberStyle[];
  values: ValueStack[] = [];

  constructor(styles: NumberStyle[] = ["1"]) {
    this.stack = [1];
    this.styles = styles;
  }

  saveValue = (value: any, enumerated: boolean = true) => {
    let stack = this.stack.slice(0, -2);
    let a = stack.reduce(a => _.last(a)!.children, this.values);
    let entry = _.last(a)!;
    entry.value = value;
    entry.enumerated = enumerated;
  }

  position = (): CounterPosition => new CounterPosition(this.stack.slice(0, -1), this.styles);

  push = (): CounterPosition => {
    this.stack
      .slice(0, -1)
      .reduce(a => _.last(a)!.children, this.values)
      .push({
        value: undefined,
        enumerated: true,
        children: [],
      });

    this.stack.push(1);

    return this.position();
  };

  Push: React.FC = () => {
    this.push();
    return null;
  };

  Pop: React.FC = () => {
    this.stack.pop();
    this.stack[this.stack.length - 1] += 1;
    return null;
  };
}

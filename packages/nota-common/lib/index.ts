import _ from "lodash";

import "../css/index.scss";

export interface Some<T> {
  type: "Some";
  value: T;
}

export interface None {
  type: "None";
}

export type Option<T> = Some<T> | None;

export let some = <T>(value: T): Option<T> => ({ type: "Some", value });
export let none = <T>(): Option<T> => ({ type: "None" });
export let isSome = <T>(opt: Option<T>): opt is Some<T> => opt.type == "Some";
export let isNone = <T>(opt: Option<T>): opt is None => opt.type == "None";
export let optUnwrap = <T>(opt: Option<T>): T => {
  if (isSome(opt)) {
    return opt.value;
  } else {
    throw `Could not unwrap None`;
  }
};

export interface Ok<T> {
  type: "Ok";
  value: T;
}

export interface Err<E> {
  type: "Err";
  value: E;
}

export type Result<T, E = Error> = Ok<T> | Err<E>;

export let ok = <T>(value: T): Ok<T> => ({ type: "Ok", value });
export let err = <E>(value: E): Err<E> => ({ type: "Err", value });
export let isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.type == "Ok";
export let isErr = <T, E>(result: Result<T, E>): result is Err<E> => result.type == "Err";
export let resUnwrap = <T, E>(result: Result<T, E>): T => {
  if (isOk(result)) {
    return result.value;
  } else {
    throw result.value;
  }
};

export type Either<L, R> = Left<L> | Right<R>;
export interface Left<L> {
  type: "Left";
  value: L;
}
export interface Right<R> {
  type: "Right";
  value: R;
}

export let left = <L, R>(value: L): Either<L, R> => ({ type: "Left", value });
export let right = <L, R>(value: R): Either<L, R> => ({ type: "Right", value });
export let isLeft = <L, R>(e: Either<L, R>): e is Left<L> => e.type == "Left";
export let isRight = <L, R>(e: Either<L, R>): e is Right<R> => e.type == "Right";

export let assert = (b: boolean) => {
  if (!b) {
    console.trace("Assertion failed");
  }
};

export let unreachable = (): never => {
  console.trace("Unreacahable");
  throw `Unreachable`;
};

export interface NestedArray<T> extends Array<T | NestedArray<T>> {}
export type NotaText = NestedArray<any> | any;
export type NotaFn<Input = NotaText> = (..._args: Input[]) => NotaText;

let toString = (s: any): string => (typeof s == "string" ? s : String(s));

export let joinRecursive = (t: NotaText): string =>
  t instanceof Array ? t.map(joinRecursive).join("") : toString(t);

export let addBetween = (t: NotaText, el: any): NotaText => {
  if (t instanceof Array) {
    let l2: NestedArray<any> = [];
    let el_s = toString(el);
    t.forEach((inner, i) => {
      if (i > 0) {
        l2.push(el_s);
      }
      l2.push(inner);
    });
    return l2;
  } else {
    return t;
  }
};

export let zipExn = <S, T>(l1: S[], l2: T[]): [S, T][] => {
  if (l1.length != l2.length) {
    throw `Cannot zip lists of length ${l1.length} and ${l2.length}`;
  }

  return _.zip(l1, l2) as any;
};

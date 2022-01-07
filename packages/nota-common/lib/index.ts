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
export let is_ok = <T, E>(result: Result<T, E>): result is Ok<T> => result.type == "Ok";
export let is_err = <T, E>(result: Result<T, E>): result is Err<E> => result.type == "Err";
export let unwrap = <T, E>(result: Result<T, E>): T => {
  if (is_ok(result)) {
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
export let is_left = <L, R>(e: Either<L, R>): e is Left<L> => e.type == "Left";
export let is_right = <L, R>(e: Either<L, R>): e is Right<R> => e.type == "Right";

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
export type NotaText = NestedArray<string>;
export type NotaFn<Input = NotaText> = (..._args: Input[]) => NotaText;

export let join_recursive = (t: NotaText | string): string => {
  if (t instanceof Array) {
    return t.map(join_recursive).join("");
  } else if (typeof t != 'string') {
    console.error("Invalid element in join_recursive", t);
    throw `Element must be string: ${t}`; 
  } else {
    return t;
  }
};

export let add_between = (l: NotaText, el: string): NotaText => {
  let l2: NotaText = [];
  l.forEach((t, i) => {
    if (i > 0) {
      l2.push(el);
    }
    l2.push(t);
  });
  return l2;
};

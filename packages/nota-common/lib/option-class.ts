export type Option<T> = Some<T> | None<T>;

export interface OptionMethods<T> {
  unwrap(): T;
}

export class Some<T> implements OptionMethods<T> {
  t: T;

  static mk<T>(t: T): Option<T> {
    return new Some(t);
  }

  constructor(t: T) {
    this.t = t;
  }

  unwrap(): T {
    return this.t;
  }
}

export class None<T> implements OptionMethods<T> {
  static mk<T>(): Option<T> {
    return new None;
  }

  unwrap(): T {
    throw `Attempted to unwrap a None`;
  }
}

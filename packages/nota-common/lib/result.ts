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

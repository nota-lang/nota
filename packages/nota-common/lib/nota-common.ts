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

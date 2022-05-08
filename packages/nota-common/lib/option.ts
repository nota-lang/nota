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

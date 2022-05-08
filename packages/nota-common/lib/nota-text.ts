export interface NestedArray<T> extends Array<T | NestedArray<T>> {}

/** The core datatype in the Nota "ABI": an arbitrarily-nested array of objects. */
export type NotaText = NestedArray<any> | any;

export type NotaFn<Input = NotaText> = (..._args: Input[]) => NotaText;

let toString = (s: any): string => (typeof s == "string" ? s : String(s));

/** Flattens a NotaText into a single string. */
export let joinRecursive = (t: NotaText): string =>
  t instanceof Array ? t.map(joinRecursive).join("") : toString(t);

/** Inserts an element between every pair of adajacent elements in the given Nota text. */
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

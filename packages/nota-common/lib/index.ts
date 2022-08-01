/**
 * Utilities shared across Nota frontend and backend packages.
 * @module
 */
import _ from "lodash";

export * as either from "./either.js";
export * as result from "./result.js";
export * as option from "./option.js";
export * as notaText from "./nota-text.js";

export let assert = (b: boolean) => {
  if (!b) {
    console.trace();
    throw new Error(`Assertion failed`);
  }
};

export let unreachable = (): never => {
  console.trace("Unreachable");
  throw new Error(`Unreachable`);
};

/** Zip, but it fails if the two lists are a different length. */
export let zipExn = <S, T>(l1: S[], l2: T[]): [S, T][] => {
  if (l1.length != l2.length) {
    throw new Error(`Cannot zip lists of length ${l1.length} and ${l2.length}`);
  }

  return _.zip(l1, l2) as any;
};

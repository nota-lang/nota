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

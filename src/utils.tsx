import React, { forwardRef, useEffect, useRef } from "react";
import _ from "lodash";

export let zipExn = <S, T>(l1: S[], l2: T[]): [S, T][] => {
  if (l1.length != l2.length) {
    throw `Cannot zip lists of length ${l1.length} and ${l2.length}`;
  }

  return _.zip(l1, l2) as any;
};

export type HTMLAttributes = React.HTMLAttributes<HTMLElement>;

export let AdaptiveDisplay = forwardRef<HTMLDivElement, { block?: boolean } & HTMLAttributes>(
  ({ block, ...props }, ref) => {
    if (block) {
      return <div ref={ref} {...props} />;
    } else {
      return <span ref={ref} {...props} />;
    }
  }
);

export function useMutationObserver<T extends HTMLElement = HTMLDivElement>(
  callback: MutationCallback,
  options: MutationObserverInit
): React.RefObject<T> {
  let ref = useRef<T>(null);

  useEffect(() => {
    let observer = new MutationObserver(callback);
    observer.observe(ref.current!, options);
    return () => observer.disconnect();
  }, [ref, callback]);

  return ref;
}

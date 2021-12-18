import React, { forwardRef, useEffect, useRef, useState } from "react";
import _ from "lodash";

export let zipExn = <S, T>(l1: S[], l2: T[]): [S, T][] => {
  if (l1.length != l2.length) {
    throw `Cannot zip lists of length ${l1.length} and ${l2.length}`;
  }

  return _.zip(l1, l2) as any;
};

export type HTMLAttributes = React.AllHTMLAttributes<HTMLElement>;
export type ReactReturn = React.ReactElement<any, any> | null;

export let Container = forwardRef<HTMLDivElement, { block?: boolean } & HTMLAttributes>(
  function Container({ block, ...props }, ref) {
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
    if (!ref.current) {
      throw `Invalid ref in useMutationObserver`;
    }

    observer.observe(ref.current, options);
    return () => observer.disconnect();
  }, [ref, callback]);

  return ref;
}

export let useSynchronizer = (callback: () => void): (() => () => void) => {
  let promises: Promise<null>[] = [];
  useEffect(() => {
    Promise.all(promises).then(callback);
  }, [callback]);

  return () => {
    let resolve: () => void;
    let promise: Promise<null> = new Promise(r => {
      resolve = () => r(null);
    });
    promises.push(promise);
    return resolve!;
  };
};

export let useStateOnInterval = <T,>(init: T, interval: number, callback: () => T) => {
  let [state, set_state] = useState(init);
  useEffect(() => {
    let instance = setInterval(() => {
      let new_state = callback();
      if (!_.isEqual(new_state, state)) {
        set_state(callback);
      }
    }, interval);
    return () => clearInterval(instance);
  }, [callback, interval]);
  return state;
};

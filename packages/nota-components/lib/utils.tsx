import React, { forwardRef, useEffect, useRef, useState } from "react";
import _ from "lodash";

export type HTMLAttributes = React.AllHTMLAttributes<HTMLElement>;
export type ReactNode = React.ReactNode;
export type ReactConstructor<P = {}> = React.FunctionComponent<P> | React.ComponentClass<P>;

export let isConstructor = <P,>(t: ReactNode | ReactConstructor<P>): t is ReactConstructor<P> => {
  let isCls = t !== null && typeof t === "object" && "type" in t && typeof t.type === "function";
  let isWrapper =
    t !== null &&
    typeof t === "object" &&
    "$$typeof" in t &&
    t["$$typeof"] === Symbol.for("react.forward_ref");
  let isFc = typeof t === "function";
  return isCls || isWrapper || isFc;
};

export let getOrRender = <P extends object>(
  T: ReactNode | ReactConstructor<P>,
  p: P
): ReactNode => {
  if (isConstructor(T)) {
    return <T {...p} />;
  } else {
    return T;
  }
};

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
  let [state, setState] = useState(init);
  useEffect(() => {
    let instance = setInterval(() => {
      let newState = callback();
      if (!_.isEqual(newState, state)) {
        setState(callback);
      }
    }, interval);
    return () => clearInterval(instance);
  }, [callback, interval]);
  return state;
};

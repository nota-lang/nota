import React, { forwardRef, useEffect, useRef, useState } from "react";
import _ from "lodash";

export type HTMLAttributes = React.AllHTMLAttributes<HTMLElement>;
export type ReactNode = React.ReactNode;
export type ReactConstructor<P = {}> = React.FunctionComponent<P> | React.ComponentClass<P>;

export let is_constructor = <P,>(t: ReactNode | ReactConstructor<P>): t is ReactConstructor<P> => {
  let is_cls = t !== null && typeof t === "object" && "type" in t && typeof t.type === "function";
  let is_wrapper =
    t !== null &&
    typeof t === "object" &&
    "$$typeof" in t &&
    t["$$typeof"] === Symbol.for("react.forward_ref");
  let is_fc = typeof t === "function";
  return is_cls || is_wrapper || is_fc;
};

export let get_or_render = <P,>(T: ReactNode | ReactConstructor<P>, p: P): ReactNode => {
  if (is_constructor(T)) {
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

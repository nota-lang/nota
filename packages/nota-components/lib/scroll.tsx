import React, { CSSProperties, forwardRef } from "react";

import { Pluggable, Plugin, usePlugin } from "./plugin.js";
import { HTMLAttributes } from "./utils.js";

// https://stackoverflow.com/questions/5353934/check-if-element-is-visible-on-screen
function checkVisible(elm: any): boolean {
  var rect = elm.getBoundingClientRect();
  return !(rect.bottom < 0 || rect.top - window.innerHeight >= 0);
}

let getAncestors = (el: Node): Node[] => {
  let nodes = [el];
  while (el.parentNode) {
    nodes.push(el.parentNode);
    el = el.parentNode;
  }
  return nodes;
};

export interface LocalLinkProps {
  target: string;
  block?: boolean;
  event?: string;
}

export let LocalLink = forwardRef<HTMLAnchorElement, LocalLinkProps & HTMLAttributes>(
  function LocalLink({ children, target, block, event, ...attrs }, ref) {
    let plugin = usePlugin(ScrollPlugin);

    let callback: React.MouseEventHandler = e => {
      e.preventDefault();
      e.stopPropagation();
      plugin.scrollTo(target);
    };

    event = event || "onClick";
    let props = { [event]: callback };
    if (event != "onClick") {
      props.onClick = e => {
        e.preventDefault();
      };
    }

    let style: CSSProperties = {};
    if (block) {
      style.display = "block";
    }

    return (
      <a ref={ref} href={`#${target}`} style={style} {...props} {...attrs}>
        {children}
      </a>
    );
  }
);

export let ScrollPlugin = new Plugin(
  class extends Pluggable {
    scrollHooks: { [id: string]: () => void } = {};
    stateful = true;

    registerScrollHook = (id: string, cb: () => void) => {
      this.scrollHooks[id] = cb;
    };

    scrollTo = (anchorId: string) => {
      let anchorElem = document.getElementById(anchorId);
      if (!anchorElem) {
        console.warn(`Trying to scroll to missing element: ${anchorId}`);
        return;
      }

      let anchorHash = "#" + anchorId;
      window.history.pushState(null, "", anchorHash);

      let flashClass = anchorElem instanceof HTMLElement ? "yellowflash" : "yellowflash-outline";
      anchorElem.classList.remove(flashClass);

      // Hack to ensure that CSS animation will restart by forcing reflow of element.
      // Unclear what performance implications this has if any?
      // See: https://css-tricks.com/restart-css-animation/
      anchorElem.getBoundingClientRect();

      anchorElem.classList.add(flashClass);

      // Expand any containers that wrap the anchor
      let ancestors = getAncestors(anchorElem);
      let expanded = false;
      ancestors.forEach((node: any) => {
        if ("id" in node && node.id in this.scrollHooks) {
          this.scrollHooks[node.id]();
          expanded = true;
        }
      });

      // Don't scroll if element is visible
      // See: https://stackoverflow.com/questions/19669786/check-if-element-is-visible-in-dom
      if (!expanded && checkVisible(anchorElem)) {
        return;
      }

      let block: ScrollLogicalPosition =
        anchorElem!.offsetHeight > window.innerHeight ? "start" : "center";
      anchorElem!.scrollIntoView({
        block,
        inline: "center",
      });
    };
  }
);

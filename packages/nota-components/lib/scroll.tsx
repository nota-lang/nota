import { Plugin, Pluggable } from "./plugin";

// https://stackoverflow.com/questions/5353934/check-if-element-is-visible-on-screen
function checkVisible(elm: any): boolean {
  var rect = elm.getBoundingClientRect();
  return !(rect.bottom < 0 || rect.top - window.innerHeight >= 0);
}

let get_ancestors = (el: Node): Node[] => {
  let nodes = [];
  while (el.parentNode) {
    nodes.push(el.parentNode);
    el = el.parentNode;
  }
  return nodes;
};

export let ScrollPlugin = new Plugin(
  class extends Pluggable {
    scroll_hooks: { [id: string]: () => void } = {};
    stateful = true;

    register_scroll_hook = (id: string, cb: () => void) => {
      this.scroll_hooks[id] = cb;
    };

    scroll_to = (anchor_id: string) => {
      let anchor_elem = document.getElementById(anchor_id)!;
      let anchor_hash = "#" + anchor_id;
      window.history.pushState(null, "", anchor_hash);

      anchor_elem.classList.remove("yellowflash");
      
      // Hack to ensure that CSS animation will restart by forcing reflow of element.
      // Unclear what performance implications this has if any?
      // See: https://css-tricks.com/restart-css-animation/
      void anchor_elem.offsetWidth;
      
      anchor_elem.classList.add("yellowflash");

      // Expand any containers that wrap the anchor
      let ancestors = get_ancestors(anchor_elem);
      let expanded = false;
      ancestors.forEach(node => {
        if (node instanceof HTMLElement && node.id in this.scroll_hooks) {
          this.scroll_hooks[node.id]();
          expanded = true;
        }
      });

      // Don't scroll if element is visible
      // See: https://stackoverflow.com/questions/19669786/check-if-element-is-visible-in-dom
      if (!expanded && checkVisible(anchor_elem)) {
        return;
      }

      let block: ScrollLogicalPosition =
        anchor_elem!.offsetHeight > window.innerHeight ? "start" : "center";
      anchor_elem!.scrollIntoView({
        block,
        inline: "center",
      });
    };
  }
);